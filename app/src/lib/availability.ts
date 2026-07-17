// Calcul des créneaux disponibles : horaires d'ouverture + congés
// + RDV en BDD + périodes occupées Google Agenda, avec buffer trajet.
import type { Settings } from "@prisma/client";
import { prisma } from "./prisma";
import { getBusyPeriods } from "./google";
import { parseOpeningHours, parseDaysOff } from "./settings";
import { parisTimeToUtc, utcToParis, addDaysStr, todayParis } from "./dates";

export type DaySlots = { date: string; slots: string[] }; // slots = ISO UTC des débuts

type Interval = { start: Date; end: Date };

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && a.end > b.start;
}

/**
 * Renvoie les créneaux libres pour les `maxDaysAhead` prochains jours.
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
  // Créneaux proposés au pas de la durée de visite (ex. toutes les 30 min).
  // Le buffer n'espace pas l'affichage : il bloque les créneaux trop proches
  // d'un RDV déjà pris (temps de trajet).
  const step = duration;

  const startDay = todayParis();
  const rangeStart = new Date();
  const rangeEnd = parisTimeToUtc(addDaysStr(startDay, settings.maxDaysAhead), "23:59");

  // Périodes occupées : RDV actifs en BDD + Google Agenda (synchro temps réel).
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
  const busy: Interval[] = [
    ...bookings.map((b) => ({ start: b.startAt, end: b.endAt })),
    ...googleBusy,
  ];

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

/** Revérifie qu'un créneau précis est toujours libre (anti double-booking à la soumission). */
export async function isSlotAvailable(
  settings: Settings,
  startAt: Date,
  excludeBookingId?: string
): Promise<boolean> {
  const days = await getAvailability(settings, excludeBookingId);
  const iso = startAt.toISOString();
  return days.some((d) => d.slots.includes(iso));
}
