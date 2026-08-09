import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { fetchFormLeads, listForms, parseLead, saveLead } from "@/lib/meta";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/admin/meta/sync — importe les prospects des formulaires de la page.
// Filet de sécurité si le webhook n'était pas encore branché : les doublons
// sont ignorés grâce à l'identifiant Meta.
export async function POST() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const settings = await getSettings();
  if (!settings.metaPageId || !settings.metaPageToken) {
    return NextResponse.json({ error: "Aucune page Facebook reliée" }, { status: 400 });
  }
  try {
    const forms = await listForms(settings.metaPageId, settings.metaPageToken);
    let imported = 0;
    let vus = 0;
    for (const form of forms) {
      const leads = await fetchFormLeads(form.id, settings.metaPageToken);
      vus += leads.length;
      for (const lead of leads) {
        if (await saveLead(parseLead(lead, form.name))) imported += 1;
      }
    }
    return NextResponse.json({ ok: true, forms: forms.length, vus, imported });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
