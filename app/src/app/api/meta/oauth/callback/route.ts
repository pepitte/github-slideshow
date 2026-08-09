import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { exchangeCodeForToken, listPages, subscribePageToLeads } from "@/lib/meta";
import { appUrl } from "@/lib/templates";

export const dynamic = "force-dynamic";

// GET /api/meta/oauth/callback?code=... — fin de la connexion du compte Meta.
// Si le compte n'a qu'une seule page, elle est reliée automatiquement ;
// sinon le gérant choisit dans la liste.
export async function GET(req: NextRequest) {
  const base = `${appUrl()}/admin/meta`;
  if (!isAdminAuthenticated()) {
    return NextResponse.redirect(`${appUrl()}/admin/login`);
  }
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code) return NextResponse.redirect(`${base}?meta=refuse`);
  if (!state || state !== cookies().get("meta_oauth_state")?.value) {
    return NextResponse.redirect(`${base}?meta=etat_invalide`);
  }

  try {
    const settings = await getSettings();
    const userToken = await exchangeCodeForToken(settings, appUrl(), code);
    const pages = await listPages(userToken);

    const data: Record<string, unknown> = { metaUserToken: userToken, metaConnectedAt: new Date() };
    if (pages.length === 1) {
      await subscribePageToLeads(pages[0]);
      data.metaPageId = pages[0].id;
      data.metaPageName = pages[0].name;
      data.metaPageToken = pages[0].access_token;
    }
    await prisma.settings.update({ where: { id: "main" }, data });

    const res = NextResponse.redirect(
      `${base}?meta=${pages.length === 1 ? "ok" : pages.length ? "choisir_page" : "aucune_page"}`
    );
    res.cookies.delete("meta_oauth_state");
    return res;
  } catch (e) {
    console.error("Connexion Meta échouée:", e);
    return NextResponse.redirect(`${base}?meta=erreur`);
  }
}
