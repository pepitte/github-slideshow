import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getAvailability, getChantierAvailability } from "@/lib/availability";

export const dynamic = "force-dynamic";

// GET /api/availability?kind=devis|chantier
//  - devis    → { kind: "devis", days: [{ date, slots: [ISO...] }] }
//  - chantier → { kind: "chantier", days: [{ date, startAt, demi, journee }] }
// ?token=... (lien d'annulation) : exclut le RDV du client pour un report.
export async function GET(req: NextRequest) {
  const settings = await getSettings();
  let kind: "devis" | "chantier" =
    req.nextUrl.searchParams.get("kind") === "chantier" ? "chantier" : "devis";
  let excludeId: string | undefined;
  const token = req.nextUrl.searchParams.get("token");
  if (token) {
    const booking = await prisma.booking.findUnique({ where: { cancelToken: token } });
    if (booking) {
      excludeId = booking.id;
      // Report : garder le même type que le RDV d'origine.
      kind = booking.kind === "chantier" ? "chantier" : "devis";
    }
  }
  // ?cp= : ne proposer que les créneaux couverts par un pro à portée du client.
  const cpParam = req.nextUrl.searchParams.get("cp") ?? "";
  let cp = /^\d{5}$/.test(cpParam) ? cpParam : undefined;
  if (!cp && excludeId) {
    // Report d'un RDV existant : on connaît le code postal du client.
    const b = await prisma.booking.findUnique({ where: { id: excludeId }, select: { postalCode: true } });
    if (b && /^\d{5}$/.test(b.postalCode)) cp = b.postalCode;
  }
  if (kind === "chantier") {
    const days = await getChantierAvailability(settings, excludeId, cp);
    return NextResponse.json({ kind, days });
  }
  const days = await getAvailability(settings, excludeId, cp);
  return NextResponse.json({ kind, days });
}
