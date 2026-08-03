import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import {
  isSlotAvailable,
  checkChantier,
  type ChantierDuration,
} from "@/lib/availability";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/google";
import { sendConfirmation } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST /api/bookings/reschedule { token, startAt } — déplace le RDV sur un
// nouveau créneau : libère l'ancien dans Google Agenda, bloque le nouveau,
// renvoie SMS + email de confirmation et réarme les rappels.
export async function POST(req: NextRequest) {
  let token = "";
  let startAtRaw = "";
  let chantierDuration: ChantierDuration = "demi";
  try {
    const body = await req.json();
    token = String(body.token ?? "");
    startAtRaw = String(body.startAt ?? "");
    if (body.chantierDuration === "journee") chantierDuration = "journee";
  } catch {}
  if (!token || !startAtRaw) {
    return NextResponse.json({ error: "token et startAt requis" }, { status: 400 });
  }
  const startAt = new Date(startAtRaw);
  if (isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "Créneau invalide" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { cancelToken: token } });
  if (!booking) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  if (booking.status === "annule") {
    return NextResponse.json({ error: "deja_annule" }, { status: 409 });
  }

  const settings = await getSettings();
  let endAt: Date;
  if (booking.kind === "chantier") {
    const chantierEnd = await checkChantier(settings, startAt, chantierDuration, booking.id);
    if (!chantierEnd) {
      return NextResponse.json({ error: "creneau_indisponible" }, { status: 409 });
    }
    endAt = chantierEnd;
  } else {
    if (!(await isSlotAvailable(settings, startAt, booking.id))) {
      return NextResponse.json({ error: "creneau_indisponible" }, { status: 409 });
    }
    endAt = new Date(startAt.getTime() + settings.visitDurationMin * 60_000);
  }

  // Libère l'ancien événement Google avant d'enregistrer le nouveau créneau.
  await deleteCalendarEvent(settings, booking.googleEventId);
  let updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      startAt,
      endAt,
      googleEventId: "",
      reminder24Sent: false,
      reminder1hSent: false,
    },
  });
  const googleEventId = await createCalendarEvent(settings, updated);
  if (googleEventId) {
    updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { googleEventId },
    });
  }

  await sendConfirmation(updated, settings);
  return NextResponse.json({ id: updated.id });
}
