import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { checkZone } from "@/lib/zone";
import {
  isSlotAvailable,
  checkChantier,
  type BookingKind,
  type ChantierDuration,
} from "@/lib/availability";
import { createCalendarEvent } from "@/lib/google";
import { sendConfirmation } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PROJECT_TYPES = ["entretien", "taille_haie", "debroussaillage", "contrat_annuel", "autre"];

// POST /api/bookings — crée la réservation, l'événement Google, et envoie SMS + email.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = String(body.email ?? "").trim();
  const address = String(body.address ?? "").trim();
  const postalCode = String(body.postalCode ?? "").trim();
  const city = String(body.city ?? "").trim();
  const projectType = String(body.projectType ?? "");
  const kind: BookingKind = body.kind === "chantier" ? "chantier" : "devis";
  const chantierDuration: ChantierDuration =
    body.chantierDuration === "journee" ? "journee" : "demi";
  const description = String(body.description ?? "").slice(0, 2000);
  // Chantier : un ou plusieurs jours (body.days) ; devis : un créneau (body.startAt).
  const daysRaw: string[] =
    kind === "chantier" && Array.isArray(body.days) && body.days.length
      ? (body.days as unknown[]).slice(0, 30).map(String)
      : [String(body.startAt ?? "")];
  const startAtRaw = daysRaw[0];
  const photos = Array.isArray(body.photos) ? (body.photos as string[]).slice(0, 6) : [];

  if (!firstName || !lastName || !phone || !email || !address || !postalCode) {
    return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
  }
  if (!PROJECT_TYPES.includes(projectType)) {
    return NextResponse.json({ error: "Type de projet invalide" }, { status: 400 });
  }
  const startAt = new Date(startAtRaw);
  if (isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "Créneau invalide" }, { status: 400 });
  }
  for (const p of photos) {
    if (typeof p !== "string" || !p.startsWith("data:image/") || p.length > 2_500_000) {
      return NextResponse.json({ error: "Photo invalide (max ~1,8 Mo chacune)" }, { status: 400 });
    }
  }

  const settings = await getSettings();

  // 1. Zone d'intervention
  const zone = await checkZone(settings, postalCode, `${address}, ${postalCode} ${city}, France`);
  if (!zone.covered) {
    return NextResponse.json({ error: "hors_zone" }, { status: 422 });
  }

  // 2. Le créneau est-il toujours libre ? (BDD + Google Agenda)
  // Chantier : un ou plusieurs jours. Plusieurs jours → journée entière chacun ;
  // un seul jour → formule choisie (demi-journée 8h-12h ou journée entière).
  const commonData = {
    firstName,
    lastName,
    phone,
    email,
    address,
    postalCode,
    city,
    lat: zone.lat,
    lng: zone.lng,
    kind,
    projectType,
    description,
  };

  if (kind === "chantier") {
    const days = Array.from(new Set(daysRaw))
      .map((d) => new Date(d))
      .sort((a, b) => a.getTime() - b.getTime());
    if (days.some((d) => isNaN(d.getTime()))) {
      return NextResponse.json({ error: "Créneau invalide" }, { status: 400 });
    }
    const formula = days.length > 1 ? "journee" : chantierDuration;
    const ends: Date[] = [];
    for (const day of days) {
      const end = await checkChantier(settings, day, formula);
      if (!end) {
        return NextResponse.json({ error: "creneau_indisponible" }, { status: 409 });
      }
      ends.push(end);
    }

    // RDV principal (lien d'annulation + photos), puis un RDV par jour supplémentaire.
    const primary = await prisma.booking.create({
      data: {
        ...commonData,
        startAt: days[0],
        endAt: ends[0],
        photos: { create: photos.map((dataUrl) => ({ dataUrl })) },
      },
    });
    const siblings = [];
    for (let i = 1; i < days.length; i++) {
      siblings.push(
        await prisma.booking.create({
          data: { ...commonData, groupId: primary.id, startAt: days[i], endAt: ends[i] },
        })
      );
    }

    // Synchro Google Agenda (un événement par jour)
    for (const b of [primary, ...siblings]) {
      const googleEventId = await createCalendarEvent(settings, b);
      if (googleEventId) {
        await prisma.booking.update({ where: { id: b.id }, data: { googleEventId } });
      }
    }

    // SMS + email de confirmation (dates groupées si plusieurs jours)
    await sendConfirmation(primary, settings, days);
    return NextResponse.json({ id: primary.id }, { status: 201 });
  }

  if (!(await isSlotAvailable(settings, startAt))) {
    return NextResponse.json({ error: "creneau_indisponible" }, { status: 409 });
  }
  const endAt = new Date(startAt.getTime() + settings.visitDurationMin * 60_000);

  const booking = await prisma.booking.create({
    data: {
      ...commonData,
      startAt,
      endAt,
      photos: { create: photos.map((dataUrl) => ({ dataUrl })) },
    },
  });

  // 3. Synchro Google Agenda (bloque le créneau côté gérant)
  const googleEventId = await createCalendarEvent(settings, booking);
  if (googleEventId) {
    await prisma.booking.update({ where: { id: booking.id }, data: { googleEventId } });
  }

  // 4. SMS de confirmation immédiat + email avec .ics — sans action du gérant.
  await sendConfirmation(booking, settings);

  return NextResponse.json({ id: booking.id }, { status: 201 });
}
