import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getAvailability } from "@/lib/availability";

export const dynamic = "force-dynamic";

// GET /api/availability → [{ date: "2026-07-15", slots: ["...ISO..."] }]
// ?token=... (lien d'annulation) : exclut le RDV du client pour un report.
export async function GET(req: NextRequest) {
  const settings = await getSettings();
  let excludeId: string | undefined;
  const token = req.nextUrl.searchParams.get("token");
  if (token) {
    const booking = await prisma.booking.findUnique({ where: { cancelToken: token } });
    if (booking) excludeId = booking.id;
  }
  const days = await getAvailability(settings, excludeId);
  return NextResponse.json({ days, visitDurationMin: settings.visitDurationMin });
}
