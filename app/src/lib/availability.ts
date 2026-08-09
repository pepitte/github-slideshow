// Calcul des créneaux disponibles : horaires d'ouverture + congés
// + RDV en BDD + périodes occupées Google Agenda, avec buffer trajet.
import type { Settings } from "@prisma/client";
import { prisma } from "./prisma";
import { getBusyPeriods } from "./google";
import { parseOpeningHours, parseChantierHours, parseDaysOff } from "./settings";
import { parisTimeToUtc, utcToParis, addDaysStr, todayParis } from "./dates";

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
 * Couverture par les professionnels : quels jours (chantier) et quels
 * couples jour+heure (devis) sont couverts par au moins un pro disponible.
 * `active` est faux si le filtre est désactivé — ou si personne n'a encore
 * déclaré la moindre disponibilité (sinon le site ne proposerait plus rien).
 */
type ProCoverage = {
  active: boolean;
  chantierDays: Set<string>;
  devisSlots: Set<string>; // "AAAA-MM-JJ HH:mm"
};

async function getProCoverage(settings: Settings, kind: BookingKind): Promise<ProCoverage> {
  const off: ProCoverage = { active: false, chantierDays: new Set(), devisSlots: new Set() };
  const mode = settings.proFilterMode;
  if (mode !== "tous" && !(mode === "chantier" && kind === "chantier")) return off;

  const pros = await prisma.pro.findMany({
    select: { status: true, datesJson: true, devisSlotsJson: true },
  });
  const parse = (json: string): string[] => {
    try {
      const arr = JSON.parse(json);
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch {
      return [];
    }
  };
  const chantierDays = new Set<string>();
  const devisSlots = new Set<string>();
  let anyDeclared = false;

  for (const pro of pros) {
    const dates = parse(pro.datesJson);
    if (dates.length) anyDeclared = true;
    if (pro.status === "disponible_chantier") {
      for (const d of dates) chantierDays.add(d);
    }
    if (pro.status === "disponible_devis") {
      const slots = parse(pro.devisSlotsJson);
      for (const d of dates) for (const h of slots) devisSlots.add(`${d} ${h}`);
    }
  }
  if (!anyDeclared) return off; // filet de sécurité
  return { active: true, chantierDays, devisSlots };
}

/**
 * Créneaux DEVIS : visites de fin de journée, toutes les 30 min.
 * Chaque créneau réserve [début - buffer, fin + buffer] pour le trajet.
 * `excludeBookingId` : RDV à ignorer (cas du report — son propre créneau
 * ne doit pas bloquer le choix du nouveau).
 */
export async function getAvailability(
  settings: Settings,
  excludeBookingId?: string
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
  const [busy, coverage] = await Promise.all([
    getBusy(settings, rangeStart, rangeEnd, excludeBookingId),
    getProCoverage(settings, "devis"),
  ]);

  const minStart = new Date(Date.now() + settings.minNoticeHours * 3600_000);
  const result: DaySlots[] = [];

  for (let i = 0; i <= settings.maxDaysAhead; i++) {
    const dateStr = addDaysStr(startDay, i);
    const weekday = utcToParis(parisTimeToUtc(dateStr, "12:00")).weekday;
    const dayConfig = openingHours[String(weekday)];
    if (!dayConfig?.enabled) continue;
    if (daysOff.some((d) => dateStr >= d.from && dateStr <= d.to)) continue;

    const dayStart = parisTimeToUtc(dateStr, dayConfig.start);
    const dayEnd = parisTimeToUtc(dateStr, dayConfig.end);
    const slots: string[] = [];

    for (
      let t = dayStart.getTime();
      t + duration * 60_000 <= dayEnd.getTime();
      t += step * 60_000
    ) {
      const slotStart = new Date(t);
      if (slotStart < minStart) continue;
      // Un professionnel doit être disponible sur ce créneau (si le filtre est actif).
      if (coverage.active && !coverage.devisSlots.has(`${dateStr} ${utcToParis(slotStart).time}`)) {
        continue;
      }
      // Le créneau bloqué inclut le buffer avant/après (temps de trajet).
      const blocked: Interval = {
        start: new Date(t - buffer * 60_000),
        end: new Date(t + (duration + buffer) * 60_000),
      };
      if (busy.some((b) => overlaps(blocked, b))) continue;
      slots.push(slotStart.toISOString());
    }
    if (slots.length > 0) result.push({ date: dateStr, slots });
  }
  return result;
}

/** Revérifie qu'un créneau devis précis est toujours libre (anti double-booking à la soumission). */
export async function isSlotAvailable(
  settings: Settings,
  startAt: Date,
  excludeBookingId?: string
): Promise<boolean> {
  const days = await getAvailability(settings, excludeBookingId);
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
  excludeBookingId?: string
): Promise<ChantierDay[]> {
  const hours = parseChantierHours(settings);
  const daysOff = parseDaysOff(settings);
  const buffer = settings.bufferMin;

  const startDay = todayParis();
  const rangeStart = new Date();
  const rangeEnd = parisTimeToUtc(addDaysStr(startDay, settings.maxDaysAhead), "23:59");
  const [busy, coverage] = await Promise.all([
    getBusy(settings, rangeStart, rangeEnd, excludeBookingId),
    getProCoverage(settings, "chantier"),
  ]);

  const minStart = new Date(Date.now() + settings.minNoticeHours * 3600_000);
  const result: ChantierDay[] = [];

  for (let i = 0; i <= settings.maxDaysAhead; i++) {
    const dateStr = addDaysStr(startDay, i);
    const weekday = utcToParis(parisTimeToUtc(dateStr, "12:00")).weekday;
    const dayConfig = hours[String(weekday)];
    if (!dayConfig?.enabled) continue;
    if (daysOff.some((d) => dateStr >= d.from && dateStr <= d.to)) continue;
    // Au moins un professionnel disponible pour le chantier ce jour-là.
    if (coverage.active && !coverage.chantierDays.has(dateStr)) continue;

    const start = parisTimeToUtc(dateStr, dayConfig.start); // 08:00
    if (start < minStart) continue;
    const demiEnd = parisTimeToUtc(dateStr, "12:00");
    const fullEnd = parisTimeToUtc(dateStr, dayConfig.end);

    const free = (end: Date) =>
      end > start &&
      !busy.some((b) =>
        overlaps(
          { start: new Date(start.getTime() - buffer * 60_000), end: new Date(end.getTime() + buffer * 60_000) },
          b
        )
      );

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
  excludeBookingId?: string
): Promise<Date | null> {
  const days = await getChantierAvailability(settings, excludeBookingId);
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
