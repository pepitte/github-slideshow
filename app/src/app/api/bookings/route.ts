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
import {
  sendConfirmation,
  notifyOwnerNewBooking,
  notifyProNewChantier,
  notifyProNewDevis,
} from "@/lib/notifications";
import { assignChantiers, assignDevis, proDeLaVisite } from "@/lib/assign";
import { creerOuCompleterContact, journaliser } from "@/lib/contacts";
import { affairePourRdv } from "@/lib/affaires";

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

  // 2. Fiche client de la base globale : créée ou complétée, jamais dupliquée.
  const contact = await creerOuCompleterContact({
    firstName,
    lastName,
    phone,
    email,
    address,
    postalCode,
    city,
    origine: "web",
  });

  // 3. Le créneau est-il toujours libre ? (BDD + Google Agenda)
  // Chantier : un ou plusieurs jours. Plusieurs jours → journée entière chacun ;
  // un seul jour → formule choisie (demi-journée 8h-12h ou journée entière).
  const commonData = {
    contactId: contact.id,
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
      const end = await checkChantier(settings, day, formula, undefined, postalCode);
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

    // Attribution automatique au pro disponible le plus proche (un chantier/jour/pro).
    // Le pro qui a fait la visite devis de ce client est prioritaire.
    const attribution = await assignChantiers(
      [primary, ...siblings].map((b) => ({ id: b.id, startAt: b.startAt! })),
      postalCode,
      [],
      await proDeLaVisite(email, phone)
    );
    // Prévenir chaque pro attribué (une seule fois, avec tous ses jours)
    const parPro = new Map<string, { pro: (typeof attribution.parJour)[0]["pro"]; days: string[] }>();
    for (const r of attribution.parJour) {
      if (!r.pro) continue;
      if (!parPro.has(r.pro.id)) parPro.set(r.pro.id, { pro: r.pro, days: [] });
      parPro.get(r.pro.id)!.days.push(r.day);
    }
    for (const { pro, days: joursPro } of Array.from(parPro.values())) {
      if (pro) await notifyProNewChantier(pro, primary, joursPro, settings);
    }
    const nonAttribues = attribution.parJour.filter((r) => !r.pro).length;
    const proLabel =
      nonAttribues === attribution.parJour.length
        ? "À ATTRIBUER — aucun professionnel disponible à portée"
        : Array.from(new Set(attribution.parJour.filter((r) => r.pro).map((r) => r.pro!.name))).join(", ") +
          (nonAttribues ? ` (+ ${nonAttribues} jour(s) à attribuer)` : "");

    // L'affaire commerciale : ouverte si le client n'en a pas déjà une.
    await affairePourRdv({ ...primary, proId: attribution.parJour[0]?.pro?.id ?? null });
    await journaliser(
      contact.id,
      "rdv",
      `Chantier réservé en ligne : ${days.length} jour(s) à partir du ${days[0].toLocaleDateString("fr-FR")}.`,
      { sens: "entrant" }
    );
    // SMS + email de confirmation (dates groupées si plusieurs jours) + alerte gérant
    const confirmationChantier = await sendConfirmation(primary, settings, days);
    await notifyOwnerNewBooking(primary, settings, days, proLabel, confirmationChantier);
    return NextResponse.json({ id: primary.id }, { status: 201 });
  }

  if (!(await isSlotAvailable(settings, startAt, undefined, postalCode))) {
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

  // 4. Attribution de la visite : le pro le plus proche ayant déclaré ce créneau ;
  //    sinon null = visite du gérant (créneau de ses horaires d'ouverture).
  const proVisite = await assignDevis({ id: booking.id, startAt }, postalCode);
  if (proVisite) await notifyProNewDevis(proVisite, booking, settings);

  // 5. SMS de confirmation immédiat + email avec .ics — sans action du gérant.
  await affairePourRdv({ ...booking, proId: proVisite?.id ?? null });
  await journaliser(
    contact.id,
    "rdv",
    `Visite devis réservée en ligne le ${startAt.toLocaleDateString("fr-FR")}.`,
    { sens: "entrant" }
  );
  const confirmation = await sendConfirmation(booking, settings);
  // 6. Alerte au gérant : plus besoin d'ouvrir le tableau de bord. Elle signale
  //    aussi l'échec éventuel de la confirmation au client.
  await notifyOwnerNewBooking(
    booking,
    settings,
    undefined,
    proVisite ? proVisite.name : undefined,
    confirmation
  );

  return NextResponse.json({ id: booking.id }, { status: 201 });
}
