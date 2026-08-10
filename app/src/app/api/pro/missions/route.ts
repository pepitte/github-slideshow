import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentProId } from "@/lib/proAuth";
import { getSettings } from "@/lib/settings";
import { assignChantiers, bookingDay } from "@/lib/assign";
import { notifyOwnerReassign, notifyProNewChantier } from "@/lib/notifications";
import { todayParis, addDaysStr, parisTimeToUtc } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function parseDeclined(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

// GET /api/pro/missions — les chantiers du pro connecté (avec le téléphone du
// client), ceux de l'équipe (sans coordonnées), et ses heures pointées.
export async function GET() {
  const proId = currentProId();
  if (!proId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const today = todayParis();
  const from = parisTimeToUtc(today, "00:00");

  const bookings = await prisma.booking.findMany({
    where: {
      kind: "chantier",
      status: { not: "annule" },
      startAt: { gte: from },
    },
    include: { pro: { select: { id: true, name: true } } },
    orderBy: { startAt: "asc" },
  });

  // Mes chantiers : tout le détail, téléphone compris (il est sur place).
  const miens = bookings
    .filter((b) => b.proId === proId)
    .map((b) => ({
      id: b.id,
      day: b.startAt ? bookingDay(b.startAt) : "",
      startAt: b.startAt,
      endAt: b.endAt,
      firstName: b.firstName,
      lastName: b.lastName,
      phone: b.phone,
      address: b.address,
      postalCode: b.postalCode,
      city: b.city,
      projectType: b.projectType,
      description: b.description,
    }));

  // L'équipe : juste de quoi situer l'activité, aucune coordonnée client.
  const equipe = bookings
    .filter((b) => b.proId && b.proId !== proId)
    .map((b) => ({
      id: b.id,
      day: b.startAt ? bookingDay(b.startAt) : "",
      city: b.city,
      proName: b.pro?.name ?? "",
    }));

  // Heures pointées : semaine en cours (lundi → aujourd'hui) et mois en cours.
  const monday = addDaysStr(today, -((new Date(`${today}T12:00:00`).getDay() + 6) % 7));
  const firstOfMonth = `${today.slice(0, 8)}01`;
  const entries = await prisma.workEntry.findMany({
    where: { proId, date: { gte: firstOfMonth < monday ? firstOfMonth : monday, lte: today } },
    select: { date: true, arrival: true, departure: true },
  });
  const minutes = (hm: string) => {
    if (!/^\d{2}:\d{2}$/.test(hm)) return null;
    const [h, m] = hm.split(":").map(Number);
    return h * 60 + m;
  };
  let semaine = 0;
  let mois = 0;
  for (const e of entries) {
    const a = minutes(e.arrival);
    const d = minutes(e.departure);
    if (a === null || d === null || d <= a) continue;
    const total = d - a;
    if (e.date >= firstOfMonth) mois += total;
    if (e.date >= monday) semaine += total;
  }

  return NextResponse.json({ miens, equipe, heures: { semaine, mois } });
}

// POST /api/pro/missions { id, action: "decline" } — le pro se désiste :
// le chantier est réattribué au suivant le plus proche, le gérant est prévenu.
export async function POST(req: NextRequest) {
  const proId = currentProId();
  if (!proId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  let body: { id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (body.action !== "decline" || !body.id) {
    return NextResponse.json({ error: "action invalide" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id: body.id } });
  if (!booking || booking.proId !== proId || !booking.startAt) {
    return NextResponse.json({ error: "Ce chantier ne vous est pas attribué" }, { status: 404 });
  }
  const ancien = await prisma.pro.findUnique({ where: { id: proId } });
  if (!ancien) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // Mémorise le désistement (on ne lui repropose pas) puis réattribue.
  const declined = Array.from(new Set([...parseDeclined(booking.declinedProsJson), proId]));
  await prisma.booking.update({
    where: { id: booking.id },
    data: { declinedProsJson: JSON.stringify(declined), proId: null },
  });
  const result = await assignChantiers(
    [{ id: booking.id, startAt: booking.startAt }],
    booking.postalCode,
    declined
  );
  const nouveau = result.parJour[0]?.pro ?? null;

  const settings = await getSettings();
  if (nouveau) {
    await notifyProNewChantier(nouveau, booking, [bookingDay(booking.startAt)], settings);
  }
  await notifyOwnerReassign(settings, booking, ancien, nouveau);

  return NextResponse.json({
    ok: true,
    reattribue: Boolean(nouveau),
    message: nouveau
      ? `Le chantier a été réattribué à ${nouveau.name}. Le gérant est prévenu.`
      : "Personne d'autre n'est disponible : le gérant est prévenu et reprend la main.",
  });
}
