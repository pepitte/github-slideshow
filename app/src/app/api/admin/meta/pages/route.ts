import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { listPages, subscribePageToLeads } from "@/lib/meta";

export const dynamic = "force-dynamic";

// GET /api/admin/meta/pages — pages Facebook du compte connecté.
export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const settings = await getSettings();
  if (!settings.metaUserToken) {
    return NextResponse.json({ error: "Compte Meta non connecté" }, { status: 400 });
  }
  try {
    const pages = await listPages(settings.metaUserToken);
    return NextResponse.json({ pages: pages.map((p) => ({ id: p.id, name: p.name })) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

// POST /api/admin/meta/pages { pageId } — relie la page et l'abonne aux leads.
export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  let body: { pageId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const settings = await getSettings();
  if (!settings.metaUserToken) {
    return NextResponse.json({ error: "Compte Meta non connecté" }, { status: 400 });
  }
  try {
    const pages = await listPages(settings.metaUserToken);
    const page = pages.find((p) => p.id === body.pageId);
    if (!page) return NextResponse.json({ error: "Page introuvable" }, { status: 404 });
    // La page est reliée quoi qu'il arrive : sans l'abonnement temps réel,
    // l'import des prospects fonctionne toujours.
    let abonnee = true;
    let avertissement = "";
    try {
      await subscribePageToLeads(page);
    } catch (e) {
      abonnee = false;
      avertissement = (e as Error).message;
      console.error("Abonnement leadgen refusé:", e);
    }
    await prisma.settings.update({
      where: { id: "main" },
      data: { metaPageId: page.id, metaPageName: page.name, metaPageToken: page.access_token },
    });
    return NextResponse.json({
      ok: true,
      pageId: page.id,
      pageName: page.name,
      abonnee,
      avertissement,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
