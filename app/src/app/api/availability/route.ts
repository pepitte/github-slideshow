import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getAvailability } from "@/lib/availability";

export const dynamic = "force-dynamic";

// GET /api/availability?kind=devis|chantier → [{ date, slots }]
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
  const days = await getAvailability(settings, { kind, excludeBookingId: excludeId });
  return NextResponse.json({ days });
}
