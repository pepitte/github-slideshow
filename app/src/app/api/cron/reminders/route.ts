import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { sendReminder24h, sendReminder1h } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/reminders — à appeler toutes les 10-15 min (Vercel Cron ou autre).
// Envoie les rappels SMS 24 h et 1 h avant chaque RDV. Protégé par CRON_SECRET.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("authorization")?.replace("Bearer ", "") ??
    req.nextUrl.searchParams.get("secret") ??
    "";
  if (secret && provided !== secret) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const settings = await getSettings();
  const now = Date.now();
  let sent24 = 0;
  let sent1 = 0;

  // Rappel 24 h : RDV démarrant dans les 24 prochaines heures, pas encore rappelé.
  const need24 = await prisma.booking.findMany({
    where: {
      status: { notIn: ["annule"] },
      reminder24Sent: false,
      startAt: { gt: new Date(now + 3600_000), lte: new Date(now + 24 * 3600_000) },
    },
  });
  for (const b of need24) {
    if (await sendReminder24h(b, settings)) {
      await prisma.booking.update({ where: { id: b.id }, data: { reminder24Sent: true } });
      sent24++;
    }
  }

  // Rappel 1 h : RDV démarrant dans l'heure.
  const need1 = await prisma.booking.findMany({
    where: {
      status: { notIn: ["annule"] },
      reminder1hSent: false,
      startAt: { gt: new Date(now), lte: new Date(now + 3600_000) },
    },
  });
  for (const b of need1) {
    if (await sendReminder1h(b, settings)) {
      await prisma.booking.update({ where: { id: b.id }, data: { reminder1hSent: true } });
      sent1++;
    }
  }

  return NextResponse.json({ ok: true, sent24h: sent24, sent1h: sent1 });
}
