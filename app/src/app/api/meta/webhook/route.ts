import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { fetchLead, parseLead, saveLead, verifySignature } from "@/lib/meta";
import { notifyOwnerNewLead } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/meta/webhook — vérification de l'URL par Meta (hub.challenge).
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const settings = await getSettings();
  if (
    p.get("hub.mode") === "subscribe" &&
    settings.metaVerifyToken &&
    p.get("hub.verify_token") === settings.metaVerifyToken
  ) {
    return new NextResponse(p.get("hub.challenge") ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ error: "Vérification refusée" }, { status: 403 });
}

// POST /api/meta/webhook — Meta annonce un nouveau lead publicitaire.
// Répondre vite : Meta réessaie si la réponse tarde.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const settings = await getSettings();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), settings.metaAppSecret)) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }
  if (!settings.metaLeadsEnabled) return NextResponse.json({ ok: true });

  let body: {
    entry?: { changes?: { field?: string; value?: Record<string, unknown> }[] }[];
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;
      const leadgenId = String(change.value?.leadgen_id ?? "");
      if (!leadgenId) continue;
      try {
        let parsed;
        if (settings.metaPageToken) {
          parsed = parseLead(await fetchLead(leadgenId, settings.metaPageToken));
        } else {
          // Page pas encore reliée : on garde la trace du lead pour l'importer ensuite.
          parsed = parseLead({ id: leadgenId });
          parsed.message = "Détails à importer (page Meta non reliée).";
        }
        if (await saveLead(parsed)) {
          const lead = await prisma.lead.findUnique({ where: { externalId: leadgenId } });
          if (lead) await notifyOwnerNewLead(lead, settings);
        }
      } catch (e) {
        console.error("Lead Meta non récupéré:", leadgenId, e);
      }
    }
  }
  return NextResponse.json({ ok: true });
}
