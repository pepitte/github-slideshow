import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { deleteCalendarEvent } from "@/lib/google";

export const dynamic = "force-dynamic";

// POST /api/bookings/cancel { token } — annule le RDV et libère le créneau Google Agenda.
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
  await deleteCalendarEvent(settings, booking.googleEventId);
  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "annule", cancelledAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
