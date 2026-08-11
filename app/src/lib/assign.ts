// Attribution automatique des chantiers au professionnel disponible le plus
// proche du client. Les règles, dans l'ordre :
//   1. le pro a coché la date dans son agenda (c'est la SEULE déclaration de
//      disponibilité : il n'existe plus de statut « indisponible ») ;
//   2. il n'a pas déjà un chantier ce jour-là (un chantier par jour et par pro) ;
//   3. il est à portée : distance code postal client ↔ code postal du pro ≤ son rayon ;
//   4. le plus proche gagne — à égalité, celui qui a le moins de chantiers
//      sur la semaine (le travail se répartit au lieu de tomber toujours sur le même).
// Personne d'éligible → le RDV reste « à attribuer » et le gérant est alerté.
import type { Pro } from "@prisma/client";
import { prisma } from "./prisma";
import { cpToLatLng, distanceKm } from "./geo";
import { utcToParis } from "./dates";
import { parseDates, parseDispo } from "./proStatus";
import { joursAbsents } from "./absences";

export { parseDispo };

export type Candidate = {
  pro: Pro;
  /** Distance en km, ou null si l'un des deux codes postaux est inconnu. */
  distance: number | null;
  eligible: boolean;
  raison: string;
};

/** Jour de Paris (AAAA-MM-JJ) d'un RDV. */
export function bookingDay(startAt: Date): string {
  return utcToParis(startAt).date;
}

/** Nombre de chantiers déjà attribués à chaque pro par jour, sur les jours donnés. */
async function chantiersParProEtJour(
  days: string[],
  excludeBookingId?: string
): Promise<Map<string, Set<string>>> {
  if (!days.length) return new Map();
  const sorted = [...days].sort();
  const from = new Date(`${sorted[0]}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 1); // marge fuseau
  const to = new Date(`${sorted[sorted.length - 1]}T00:00:00Z`);
  to.setUTCDate(to.getUTCDate() + 2);
  const rows = await prisma.booking.findMany({
    where: {
      kind: "chantier",
      status: { not: "annule" },
      proId: { not: null },
      startAt: { gte: from, lt: to },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: { proId: true, startAt: true },
  });
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.proId || !r.startAt) continue;
    const day = bookingDay(r.startAt);
    if (!map.has(r.proId)) map.set(r.proId, new Set());
    map.get(r.proId)!.add(day);
  }
  return map;
}

/** Charge de la semaine (lundi-dimanche) contenant `day`, par pro. */
async function chargeSemaine(day: string): Promise<Map<string, number>> {
  const d = new Date(`${day}T00:00:00Z`);
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - 1);
  const end = new Date(monday);
  end.setUTCDate(monday.getUTCDate() + 9);
  const rows = await prisma.booking.findMany({
    where: {
      kind: "chantier",
      status: { not: "annule" },
      proId: { not: null },
      startAt: { gte: monday, lt: end },
    },
    select: { proId: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.proId) map.set(r.proId, (map.get(r.proId) ?? 0) + 1);
  }
  return map;
}

/**
 * Tous les pros, avec les jours de chantier qu'ils ont cochés. Ne rien cocher
 * = ne rien recevoir : c'est la seule façon de se déclarer indisponible.
 */
export async function prosChantier(): Promise<(Pro & { jours: string[]; absents: Set<string> })[]> {
  const pros = await prisma.pro.findMany();
  const tousJours = pros.flatMap((p) => parseDates(p.datesJson)).sort();
  const absences = tousJours.length
    ? await joursAbsents(tousJours[0], tousJours[tousJours.length - 1])
    : new Map<string, Set<string>>();
  return pros.map((p) =>
    Object.assign(p, {
      jours: parseDates(p.datesJson),
      absents: absences.get(p.id) ?? new Set<string>(),
    })
  );
}

/**
 * Classement des pros pour un jour + un client donnés.
 * `busy` : jours déjà pris par pro (précalculé) ; `exclude` : pros écartés (désistés).
 */
export function rankCandidates(
  pros: (Pro & { jours: string[]; absents?: Set<string> })[],
  day: string,
  clientCp: string,
  busy: Map<string, Set<string>>,
  charge: Map<string, number>,
  exclude: string[] = []
): Candidate[] {
  const clientPos = cpToLatLng(clientCp);
  const out: Candidate[] = [];
  for (const pro of pros) {
    const c: Candidate = { pro, distance: null, eligible: false, raison: "" };
    const proPos = cpToLatLng(pro.basePostalCode);
    if (clientPos && proPos) c.distance = Math.round(distanceKm(clientPos, proPos) * 10) / 10;
    if (exclude.includes(pro.id)) {
      c.raison = "s'est désisté";
    } else if (pro.absents?.has(day)) {
      c.raison = "absent (congés ou indisponibilité déclarée)";
    } else if (!pro.jours.includes(day)) {
      c.raison = "pas disponible ce jour";
    } else if (busy.get(pro.id)?.has(day)) {
      c.raison = "déjà un chantier ce jour";
    } else if (c.distance !== null && c.distance > pro.radiusKm) {
      c.raison = `hors rayon (${c.distance} km > ${pro.radiusKm} km)`;
    } else {
      c.eligible = true;
      c.raison = c.distance !== null ? `${c.distance} km` : "distance inconnue";
    }
    out.push(c);
  }
  // Éligibles d'abord, du plus proche au plus loin (distance inconnue en dernier),
  // à égalité : le moins chargé de la semaine.
  out.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    const da = a.distance ?? Infinity;
    const db = b.distance ?? Infinity;
    if (Math.abs(da - db) > 0.5) return da - db;
    return (charge.get(a.pro.id) ?? 0) - (charge.get(b.pro.id) ?? 0);
  });
  return out;
}

export type AssignResult = {
  /** bookingId → pro attribué (null si personne). */
  parJour: { bookingId: string; day: string; pro: Pro | null }[];
};

/**
 * Attribue un groupe de RDV chantier (un par jour). On privilégie un pro
 * capable de couvrir TOUS les jours (même personne sur place) ; sinon,
 * attribution jour par jour au plus proche.
 */
export async function assignChantiers(
  bookings: { id: string; startAt: Date }[],
  clientCp: string,
  exclude: string[] = [],
  preferProId?: string | null
): Promise<AssignResult> {
  const days = bookings.map((b) => bookingDay(b.startAt));
  const [pros, busy, charge] = await Promise.all([
    prosChantier(),
    chantiersParProEtJour(days),
    chargeSemaine(days[0]),
  ]);

  // Un pro éligible sur tous les jours ?
  const parJourRanking = days.map((day) => rankCandidates(pros, day, clientCp, busy, charge, exclude));
  const communs = parJourRanking[0]
    .filter((c) => c.eligible)
    .filter((c) =>
      parJourRanking.every((ranking) =>
        ranking.some((r) => r.eligible && r.pro.id === c.pro.id)
      )
    );

  const result: AssignResult = { parJour: [] };
  if (communs.length > 0) {
    // Le pro qui a fait la visite devis du client passe devant, s'il est éligible.
    const prefere = preferProId ? communs.find((c) => c.pro.id === preferProId) : undefined;
    const pro = (prefere ?? communs[0]).pro;
    for (let i = 0; i < bookings.length; i++) {
      result.parJour.push({ bookingId: bookings[i].id, day: days[i], pro });
    }
  } else {
    for (let i = 0; i < bookings.length; i++) {
      const best = parJourRanking[i].find((c) => c.eligible) ?? null;
      result.parJour.push({ bookingId: bookings[i].id, day: days[i], pro: best?.pro ?? null });
    }
  }

  for (const r of result.parJour) {
    await prisma.booking.update({
      where: { id: r.bookingId },
      data: { proId: r.pro?.id ?? null },
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Visites devis : mêmes principes que les chantiers, à la demi-heure près.
// Un créneau déclaré par un pro est réservable tant qu'il n'a pas déjà une
// visite devis qui chevauche ce créneau (30 min par visite).
// ---------------------------------------------------------------------------

/** Tous les pros, avec les créneaux de visite qu'ils ont déclarés jour par jour. */
export async function prosDevis(): Promise<(Pro & { dispo: Record<string, string[]> })[]> {
  const pros = await prisma.pro.findMany();
  const jours = pros.flatMap((p) => Object.keys(parseDispo(p.devisDispoJson))).sort();
  const absences = jours.length
    ? await joursAbsents(jours[0], jours[jours.length - 1])
    : new Map<string, Set<string>>();
  return pros.map((p) => {
    const absents = absences.get(p.id);
    const dispo = parseDispo(p.devisDispoJson);
    // Une visite ne peut pas être proposée un jour d'absence déclarée.
    if (absents) for (const j of Array.from(absents)) delete dispo[j];
    return Object.assign(p, { dispo });
  });
}

/** Visites devis déjà attribuées, par pro : Set de « AAAA-MM-JJ HH:mm ». */
async function devisPrisParPro(excludeBookingId?: string): Promise<Map<string, Set<string>>> {
  const rows = await prisma.booking.findMany({
    where: {
      kind: "devis",
      status: { not: "annule" },
      proId: { not: null },
      startAt: { gte: new Date() },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: { proId: true, startAt: true },
  });
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.proId || !r.startAt) continue;
    const paris = utcToParis(r.startAt);
    if (!map.has(r.proId)) map.set(r.proId, new Set());
    map.get(r.proId)!.add(`${paris.date} ${paris.time}`);
  }
  return map;
}

/**
 * Créneaux devis déclarés par les pros et encore libres, jour par jour.
 * Si `clientCp` est fourni, seuls les pros à portée comptent.
 */
export async function creneauxDevisPros(
  clientCp?: string,
  excludeBookingId?: string
): Promise<Map<string, Set<string>>> {
  const [pros, pris] = await Promise.all([prosDevis(), devisPrisParPro(excludeBookingId)]);
  const clientPos = clientCp ? cpToLatLng(clientCp) : null;
  const out = new Map<string, Set<string>>();
  for (const pro of pros) {
    if (clientPos) {
      const proPos = cpToLatLng(pro.basePostalCode);
      if (proPos && distanceKm(clientPos, proPos) > pro.radiusKm) continue;
    }
    for (const [day, slots] of Object.entries(pro.dispo)) {
      for (const t of slots) {
        if (pris.get(pro.id)?.has(`${day} ${t}`)) continue;
        if (!out.has(day)) out.set(day, new Set());
        out.get(day)!.add(t);
      }
    }
  }
  return out;
}

/**
 * Attribue une visite devis au pro le plus proche ayant déclaré ce créneau
 * (et encore libre). Renvoie le pro, ou null (visite du gérant / à attribuer).
 */
export async function assignDevis(
  booking: { id: string; startAt: Date },
  clientCp: string,
  exclude: string[] = []
): Promise<Pro | null> {
  const paris = utcToParis(booking.startAt);
  const cle = `${paris.date} ${paris.time}`;
  const [pros, pris] = await Promise.all([prosDevis(), devisPrisParPro(booking.id)]);
  const clientPos = cpToLatLng(clientCp);

  const candidats = pros
    .filter((p) => !exclude.includes(p.id))
    .filter((p) => (p.dispo[paris.date] ?? []).includes(paris.time))
    .filter((p) => !pris.get(p.id)?.has(cle))
    .map((p) => {
      const pos = cpToLatLng(p.basePostalCode);
      const distance = clientPos && pos ? distanceKm(clientPos, pos) : null;
      return { pro: p, distance };
    })
    .filter((c) => c.distance === null || c.distance <= c.pro.radiusKm)
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

  const pro = candidats[0]?.pro ?? null;
  await prisma.booking.update({ where: { id: booking.id }, data: { proId: pro?.id ?? null } });
  return pro;
}

/**
 * Le pro qui a fait la visite devis de ce client (téléphone ou email) :
 * c'est lui qui doit faire le chantier si possible.
 */
export async function proDeLaVisite(email: string, phone: string): Promise<string | null> {
  if (!email && !phone) return null;
  const visite = await prisma.booking.findFirst({
    where: {
      kind: "devis",
      status: { not: "annule" },
      proId: { not: null },
      OR: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { proId: true },
  });
  return visite?.proId ?? null;
}

/**
 * Jours où au moins un pro chantier peut encore prendre un chantier
 * (sert au calcul des créneaux proposés aux clients). Si `clientCp` est
 * fourni, le rayon de chaque pro est pris en compte.
 */
export async function joursAvecCapacite(
  clientCp?: string,
  excludeBookingId?: string
): Promise<{
  actif: boolean;
  jours: Set<string>;
}> {
  const pros = await prosChantier();
  // Filet de sécurité : personne n'a rempli son planning → mode historique.
  if (!pros.some((p) => p.jours.length > 0)) return { actif: false, jours: new Set() };

  const tousJours = Array.from(new Set(pros.flatMap((p) => p.jours)));
  const busy = await chantiersParProEtJour(tousJours, excludeBookingId);
  const clientPos = clientCp ? cpToLatLng(clientCp) : null;

  const jours = new Set<string>();
  for (const day of tousJours) {
    for (const pro of pros) {
      if (!pro.jours.includes(day)) continue;
      if (pro.absents.has(day)) continue;
      if (busy.get(pro.id)?.has(day)) continue;
      if (clientPos) {
        const proPos = cpToLatLng(pro.basePostalCode);
        if (proPos && distanceKm(clientPos, proPos) > pro.radiusKm) continue;
      }
      jours.add(day);
      break;
    }
  }
  return { actif: true, jours };
}
