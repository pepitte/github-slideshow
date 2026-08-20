import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { exchangeCodeForToken, listPages, subscribePageToLeads } from "@/lib/meta";
import { requestBaseUrl } from "@/lib/templates";

export const dynamic = "force-dynamic";

// GET /api/meta/oauth/callback?code=... — fin de la connexion du compte Meta.
// Si le compte n'a qu'une seule page, elle est reliée automatiquement ;
// sinon le gérant choisit dans la liste.
export async function GET(req: NextRequest) {
  // Même domaine qu'au départ : c'est ce qui garde la session et le jeton.
  const site = requestBaseUrl(req.headers);
  const base = `${site}/admin/meta`;
  if (!isAdminAuthenticated()) {
    return NextResponse.redirect(`${site}/admin/login`);
  }
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code) return NextResponse.redirect(`${base}?meta=refuse`);
  if (!state || state !== cookies().get("meta_oauth_state")?.value) {
    return NextResponse.redirect(`${base}?meta=etat_invalide`);
  }

  try {
    const settings = await getSettings();
    const userToken = await exchangeCodeForToken(settings, site, code);
    const pages = await listPages(userToken);

    const data: Record<string, unknown> = { metaUserToken: userToken, metaConnectedAt: new Date() };
    // L'abonnement temps réel peut échouer (autorisation manquante) sans que la
    // page soit inutilisable : reliée, elle permet déjà l'import des prospects.
    // On garde donc la connexion et on signale seulement le temps réel.
    let abonnee = true;
    if (pages.length === 1) {
      try {
        await subscribePageToLeads(pages[0]);
      } catch (e) {
        abonnee = false;
        console.error("Abonnement leadgen refusé:", e);
      }
      data.metaPageId = pages[0].id;
      data.metaPageName = pages[0].name;
      data.metaPageToken = pages[0].access_token;
    }
    await prisma.settings.update({ where: { id: "main" }, data });

    const etat =
      pages.length === 1
        ? abonnee
          ? "ok"
          : "sans_temps_reel"
        : pages.length
          ? "choisir_page"
          : "aucune_page";
    const res = NextResponse.redirect(`${base}?meta=${etat}`);
    res.cookies.delete("meta_oauth_state");
    return res;
  } catch (e) {
    console.error("Connexion Meta échouée:", e);
    return NextResponse.redirect(`${base}?meta=erreur`);
  }
}
