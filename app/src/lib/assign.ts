// Attribution automatique des chantiers au professionnel disponible le plus
// proche du client. Les règles, dans l'ordre :
//   1. le pro a coché la date dans son agenda et il est « disponible chantier » ;
//   2. il n'a pas déjà un chantier ce jour-là (un chantier par jour et par pro) ;
//   3. il est à portée : distance code postal client ↔ code postal du pro ≤ son rayon ;
//   4. le plus proche gagne — à égalité, celui qui a le moins de chantiers
//      sur la semaine (le travail se répartit au lieu de tomber toujours sur le même).
// Personne d'éligible → le RDV reste « à attribuer » et le gérant est alerté.
import type { Pro } from "@prisma/client";
import { prisma } from "./prisma";
import { cpToLatLng, distanceKm } from "./geo";
import { utcToParis } from "./dates";

export type Candidate = {
  pro: Pro;
  /** Distance en km, ou null si l'un des deux codes postaux est inconnu. */
  distance: number | null;
  eligible: boolean;
  raison: string;
};

function parseDates(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

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

/** Pros « disponible chantier » ayant coché au moins un des jours demandés. */
export async function prosChantier(): Promise<(Pro & { jours: string[] })[]> {
  const pros = await prisma.pro.findMany({ where: { status: "disponible_chantier" } });
  return pros.map((p) => Object.assign(p, { jours: parseDates(p.datesJson) }));
}

/**
 * Classement des pros pour un jour + un client donnés.
 * `busy` : jours déjà pris par pro (précalculé) ; `exclude` : pros écartés (désistés).
 */
export function rankCandidates(
  pros: (Pro & { jours: string[] })[],
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
  exclude: string[] = []
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
    const pro = communs[0].pro;
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
