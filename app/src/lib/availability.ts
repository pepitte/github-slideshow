// Calcul des créneaux disponibles : horaires d'ouverture + congés
// + RDV en BDD + périodes occupées Google Agenda, avec buffer trajet.
import type { Settings } from "@prisma/client";
import { prisma } from "./prisma";
import { getBusyPeriods } from "./google";
import { parseOpeningHours, parseChantierHours, parseDaysOff } from "./settings";
import { parisTimeToUtc, utcToParis, addDaysStr, todayParis } from "./dates";
import { joursAvecCapacite, creneauxDevisPros } from "./assign";
import { agencesActives, couvertureDe } from "./agences";

/**
 * Le gérant fait lui-même les visites, mais depuis SON secteur. Dès que
 * plusieurs secteurs existent, ses horaires ne doivent plus être proposés à un
 * client d'une autre ville — sinon on promet une visite à 350 km.
 */
async function gerantCouvre(settings: Settings, clientCp?: string): Promise<boolean> {
  if (!clientCp) return true;
  const agences = await agencesActives();
  if (agences.length === 0) return true; // zone unique : comportement historique
  const sienne = agences.find((a) => couvertureDe(a, settings.basePostalCode).raison !== null);
  if (!sienne) return true; // gérant hors secteurs : on ne le bride pas
  return couvertureDe(sienne, clientCp).raison !== null;
}

export type DaySlots = { date: string; slots: string[] }; // slots = ISO UTC des débuts
export type BookingKind = "devis" | "chantier";
export type ChantierDuration = "demi" | "journee";
// Un jour de chantier : démarrage unique à 8h, en demi-journée (8h-12h) ou journée entière.
export type ChantierDay = { date: string; startAt: string; demi: boolean; journee: boolean };

type Interval = { start: Date; end: Date };

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && a.end > b.start;
}

/** Périodes occupées (RDV actifs en BDD + Google Agenda) sur la fenêtre de réservation. */
async function getBusy(
  settings: Settings,
  rangeStart: Date,
  rangeEnd: Date,
  excludeBookingId?: string
): Promise<Interval[]> {
  const [bookings, googleBusy] = await Promise.all([
    prisma.booking.findMany({
      where: {
        status: { not: "annule" },
        endAt: { gte: rangeStart },
        startAt: { lte: rangeEnd },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { startAt: true, endAt: true },
    }),
    getBusyPeriods(settings, rangeStart, rangeEnd),
  ]);
  return [
    ...bookings
      .filter((b): b is { startAt: Date; endAt: Date } => Boolean(b.startAt && b.endAt))
      .map((b) => ({ start: b.startAt, end: b.endAt })),
    ...googleBusy,
  ];
}

/**
 * Créneaux DEVIS : visites de fin de journée, toutes les 30 min.
 * Chaque créneau réserve [début - buffer, fin + buffer] pour le trajet.
 * `excludeBookingId` : RDV à ignorer (cas du report — son propre créneau
 * ne doit pas bloquer le choix du nouveau).
 */
export async function getAvailability(
  settings: Settings,
  excludeBookingId?: string,
  clientCp?: string
): Promise<DaySlots[]> {
  const openingHours = parseOpeningHours(settings);
  const daysOff = parseDaysOff(settings);
  const duration = settings.visitDurationMin;
  const buffer = settings.bufferMin;
  // Créneaux proposés au pas de la durée de visite (ex. toutes les 30 min) ;
  // le buffer n'espace pas l'affichage, il bloque les voisins d'un RDV pris.
  const step = duration;

  const startDay = todayParis();
  const rangeStart = new Date();
  const rangeEnd = parisTimeToUtc(addDaysStr(startDay, settings.maxDaysAhead), "23:59");
  // Créneaux du gérant (horaires d'ouverture, agenda Google) ∪ créneaux déclarés
  // par les pros (jour par jour, trous en journée compris) : option B du client.
  const [busy, prosSlots, gerantDispo] = await Promise.all([
    getBusy(settings, rangeStart, rangeEnd, excludeBookingId),
    creneauxDevisPros(clientCp, excludeBookingId),
    gerantCouvre(settings, clientCp),
  ]);

  const minStart = new Date(Date.now() + settings.minNoticeHours * 3600_000);
  const result: DaySlots[] = [];

  for (let i = 0; i <= settings.maxDaysAhead; i++) {
    const dateStr = addDaysStr(startDay, i);
    const weekday = utcToParis(parisTimeToUtc(dateStr, "12:00")).weekday;
    const rawConfig = openingHours[String(weekday)];
    const hasProSlots = (prosSlots.get(dateStr)?.size ?? 0) > 0;
    // Jour fermé côté gérant : reste proposé si un pro a déclaré des créneaux.
    if ((!rawConfig?.enabled || !gerantDispo) && !hasProSlots) continue;
    if (daysOff.some((d) => dateStr >= d.from && dateStr <= d.to)) continue;
    const dayConfig = rawConfig?.enabled ? rawConfig : { enabled: false, start: "00:00", end: "00:00" };

    const dayStart = parisTimeToUtc(dateStr, dayConfig.start);
    const dayEnd = parisTimeToUtc(dateStr, dayConfig.end);
    const slots = new Set<string>();

    // 1. Créneaux du gérant : horaires d'ouverture, moins l'agenda occupé.
    //    Ignorés si le client est dans un secteur que le gérant ne couvre pas.
    for (
      let t = gerantDispo ? dayStart.getTime() : dayEnd.getTime();
      t + duration * 60_000 <= dayEnd.getTime();
      t += step * 60_000
    ) {
      const slotStart = new Date(t);
      if (slotStart < minStart) continue;
      // Le créneau bloqué inclut le buffer avant/après (temps de trajet).
      const blocked: Interval = {
        start: new Date(t - buffer * 60_000),
        end: new Date(t + (duration + buffer) * 60_000),
      };
      if (busy.some((b) => overlaps(blocked, b))) continue;
      slots.add(slotStart.toISOString());
    }

    // 2. Créneaux déclarés par les pros ce jour-là (déjà nettoyés des visites prises).
    for (const time of Array.from(prosSlots.get(dateStr) ?? [])) {
      const slotStart = parisTimeToUtc(dateStr, time);
      if (slotStart < minStart) continue;
      slots.add(slotStart.toISOString());
    }

    if (slots.size > 0) result.push({ date: dateStr, slots: Array.from(slots).sort() });
  }
  return result;
}

/** Revérifie qu'un créneau devis précis est toujours libre (anti double-booking à la soumission). */
export async function isSlotAvailable(
  settings: Settings,
  startAt: Date,
  excludeBookingId?: string,
  clientCp?: string
): Promise<boolean> {
  const days = await getAvailability(settings, excludeBookingId, clientCp);
  const iso = startAt.toISOString();
  return days.some((d) => d.slots.includes(iso));
}

/**
 * Jours CHANTIER : tous les chantiers commencent à l'heure d'ouverture (8h00).
 * Pour chaque jour ouvert, deux formules possibles si l'agenda est libre :
 * demi-journée (8h → 12h) ou journée entière (8h → fin d'horaire).
 */
export async function getChantierAvailability(
  settings: Settings,
  excludeBookingId?: string,
  clientCp?: string
): Promise<ChantierDay[]> {
  const hours = parseChantierHours(settings);
  const daysOff = parseDaysOff(settings);
  const buffer = settings.bufferMin;

  const startDay = todayParis();
  const rangeStart = new Date();
  const rangeEnd = parisTimeToUtc(addDaysStr(startDay, settings.maxDaysAhead), "23:59");

  // Mode équipe : les chantiers sont attribués aux pros, la capacité d'un jour
  // = « au moins un pro à portée encore libre » (un chantier/jour/pro). L'agenda
  // Google du gérant ne compte plus. Filet de sécurité : si aucun pro n'a rempli
  // son planning, on retombe sur le mode historique (un chantier/jour, agenda gérant).
  const capacite = await joursAvecCapacite(clientCp, excludeBookingId);

  const busy = capacite.actif ? [] : await getBusy(settings, rangeStart, rangeEnd, excludeBookingId);

  const minStart = new Date(Date.now() + settings.minNoticeHours * 3600_000);
  const result: ChantierDay[] = [];

  for (let i = 0; i <= settings.maxDaysAhead; i++) {
    const dateStr = addDaysStr(startDay, i);
    const weekday = utcToParis(parisTimeToUtc(dateStr, "12:00")).weekday;
    const dayConfig = hours[String(weekday)];
    if (!dayConfig?.enabled) continue;
    if (daysOff.some((d) => dateStr >= d.from && dateStr <= d.to)) continue;
    if (capacite.actif && !capacite.jours.has(dateStr)) continue;

    const start = parisTimeToUtc(dateStr, dayConfig.start); // 08:00
    if (start < minStart) continue;
    const demiEnd = parisTimeToUtc(dateStr, "12:00");
    const fullEnd = parisTimeToUtc(dateStr, dayConfig.end);

    const free = (end: Date) =>
      end > start &&
      (capacite.actif ||
        !busy.some((b) =>
          overlaps(
            { start: new Date(start.getTime() - buffer * 60_000), end: new Date(end.getTime() + buffer * 60_000) },
            b
          )
        ));

    const demi = free(demiEnd);
    const journee = free(fullEnd);
    if (demi || journee) {
      result.push({ date: dateStr, startAt: start.toISOString(), demi, journee });
    }
  }
  return result;
}

/**
 * Valide un chantier (jour + formule) et renvoie sa fin, ou null si indisponible.
 */
export async function checkChantier(
  settings: Settings,
  startAt: Date,
  duration: ChantierDuration,
  excludeBookingId?: string,
  clientCp?: string
): Promise<Date | null> {
  const days = await getChantierAvailability(settings, excludeBookingId, clientCp);
  const day = days.find((d) => d.startAt === startAt.toISOString());
  if (!day) return null;
  if (duration === "demi" && !day.demi) return null;
  if (duration === "journee" && !day.journee) return null;
  const hours = parseChantierHours(settings);
  const weekday = utcToParis(parisTimeToUtc(day.date, "12:00")).weekday;
  const dayConfig = hours[String(weekday)];
  return duration === "demi"
    ? parisTimeToUtc(day.date, "12:00")
    : parisTimeToUtc(day.date, dayConfig?.end ?? "18:00");
}
