// Secteurs d'exploitation (agences). Un client est couvert si AU MOINS UNE
// agence le couvre. Tant qu'aucune agence n'est créée, l'application retombe
// sur la zone unique historique de Settings.
import type { Agence } from "@prisma/client";
import { prisma } from "./prisma";
import { cpToLatLng, distanceKm } from "./geo";

/** Nettoie une liste de codes postaux saisie « 33, 40 » ou « 33 40 ». */
export function normaliserCodes(v: unknown): string[] {
  const brut = Array.isArray(v) ? v.map(String) : String(v ?? "").split(/[,;\s]+/);
  return Array.from(
    new Set(brut.map((c) => c.trim()).filter((c) => /^\d{2,5}$/.test(c)))
  );
}

/** Champs modifiables d'une agence, validés (création et modification). */
export function champsAgence(body: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (typeof body.nom === "string" && body.nom.trim()) data.nom = body.nom.trim().slice(0, 60);
  if (typeof body.couleur === "string" && /^#[0-9a-fA-F]{6}$/.test(body.couleur)) {
    data.couleur = body.couleur;
  }
  if (typeof body.address === "string") data.address = body.address.trim().slice(0, 200);
  if (typeof body.city === "string") data.city = body.city.trim().slice(0, 80);
  if (typeof body.postalCode === "string") {
    const cp = body.postalCode.trim();
    data.postalCode = cp;
    // Coordonnées déduites de la table de CP embarquée : aucun service externe.
    const pos = cpToLatLng(cp);
    data.lat = pos?.lat ?? null;
    data.lng = pos?.lng ?? null;
  }
  if (Number.isFinite(Number(body.radiusKm))) {
    data.radiusKm = Math.max(0, Math.min(300, Math.round(Number(body.radiusKm))));
  }
  if (body.postalCodes !== undefined) {
    data.postalCodesJson = JSON.stringify(normaliserCodes(body.postalCodes));
  }
  if (typeof body.actif === "boolean") data.actif = body.actif;
  if (Number.isFinite(Number(body.ordre))) data.ordre = Math.round(Number(body.ordre));
  return data;
}

export type AgenceCouverture = {
  agence: Agence;
  /** Distance CP client ↔ CP agence, ou null si l'un des deux est inconnu. */
  distance: number | null;
  raison: "code_postal" | "rayon" | "aucune_restriction" | null;
};

export function parseCodes(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr)
      ? arr.map((c) => String(c).trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

/** Les agences actives, dans l'ordre d'affichage choisi par le gérant. */
export async function agencesActives(): Promise<Agence[]> {
  return prisma.agence.findMany({
    where: { actif: true },
    orderBy: [{ ordre: "asc" }, { nom: "asc" }],
  });
}

/** Un code postal correspond-il à la liste (préfixe accepté : « 33 » couvre 33000) ? */
export function cpCouvert(codes: string[], cp: string): boolean {
  return codes.some((c) => (c.length === 5 ? c === cp : cp.startsWith(c)));
}

/**
 * L'agence couvre-t-elle ce code postal ? Deux façons, non exclusives :
 * la liste de codes postaux, ou le rayon autour de l'agence (distance
 * calculée avec la table de CP embarquée, sans service externe).
 */
export function couvertureDe(agence: Agence, cp: string): AgenceCouverture {
  const codes = parseCodes(agence.postalCodesJson);
  const posAgence =
    agence.lat != null && agence.lng != null
      ? { lat: agence.lat, lng: agence.lng }
      : cpToLatLng(agence.postalCode);
  const posClient = cpToLatLng(cp);
  const distance =
    posAgence && posClient ? Math.round(distanceKm(posAgence, posClient) * 10) / 10 : null;

  if (codes.length && cpCouvert(codes, cp)) {
    return { agence, distance, raison: "code_postal" };
  }
  if (agence.radiusKm > 0 && distance !== null && distance <= agence.radiusKm) {
    return { agence, distance, raison: "rayon" };
  }
  // Agence sans aucune restriction : elle couvre tout.
  if (!codes.length && agence.radiusKm <= 0) {
    return { agence, distance, raison: "aucune_restriction" };
  }
  return { agence, distance, raison: null };
}

/**
 * L'agence la plus pertinente pour un code postal : celle qui le couvre et
 * dont le siège est le plus proche. Null si aucune ne le couvre.
 */
export async function agencePour(cp: string): Promise<AgenceCouverture | null> {
  const agences = await agencesActives();
  const couvrantes = agences
    .map((a) => couvertureDe(a, cp))
    .filter((c) => c.raison !== null)
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  return couvrantes[0] ?? null;
}
