import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { deleteCalendarEvent } from "@/lib/google";

export const dynamic = "force-dynamic";

// POST /api/bookings/cancel { token } — annule le RDV et libère le créneau
// Google Agenda. Chantier multi-jours : annule tous les jours du groupe.
export async function POST(req: NextRequest) {
  let token = "";
  try {
    token = String((await req.json()).token ?? "");
  } catch {}
  if (!token) return NextResponse.json({ error: "token requis" }, { status: 400 });

  const booking = await prisma.booking.findUnique({ where: { cancelToken: token } });
  if (!booking) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  if (booking.status === "annule") return NextResponse.json({ ok: true, already: true });

  const settings = await getSettings();
  const primaryId = booking.groupId || booking.id;
  const group = await prisma.booking.findMany({
    where: { OR: [{ id: primaryId }, { groupId: primaryId }], status: { not: "annule" } },
  });
  for (const b of group) {
    await deleteCalendarEvent(settings, b.googleEventId);
  }
  await prisma.booking.updateMany({
    where: { OR: [{ id: primaryId }, { groupId: primaryId }] },
    data: { status: "annule", cancelledAt: new Date() },
  });
  return NextResponse.json({ ok: true, cancelled: group.length });
}
