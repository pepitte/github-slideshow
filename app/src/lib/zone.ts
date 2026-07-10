import type { Settings } from "@prisma/client";
import { parsePostalCodes } from "./settings";

export type ZoneResult = { covered: boolean; reason?: string };

/** Géocode une adresse via l'API Google Geocoding (si clé configurée). */
export async function geocode(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&region=fr&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const loc = data.results?.[0]?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch {
    return null;
  }
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Vérifie si une adresse/code postal est dans la zone d'intervention.
 * - mode "postal" : le code postal doit figurer dans la liste (préfixe accepté, ex. "44" couvre tout le 44)
 * - mode "radius" : distance à vol d'oiseau depuis l'adresse de base <= rayon
 */
export async function checkZone(
  settings: Settings,
  postalCode: string,
  fullAddress?: string
): Promise<ZoneResult & { lat?: number; lng?: number }> {
  const cp = postalCode.trim();
  if (!/^\d{5}$/.test(cp)) return { covered: false, reason: "code_postal_invalide" };

  if (settings.zoneMode === "radius" && settings.baseLat != null && settings.baseLng != null) {
    const point = fullAddress ? await geocode(fullAddress) : null;
    if (point) {
      const dist = haversineKm({ lat: settings.baseLat, lng: settings.baseLng }, point);
      return dist <= settings.radiusKm
        ? { covered: true, lat: point.lat, lng: point.lng }
        : { covered: false, reason: "hors_rayon" };
    }
    // Pas de géocodage possible : on retombe sur la liste de codes postaux.
  }

  const codes = parsePostalCodes(settings);
  if (codes.length === 0) return { covered: true }; // aucune restriction configurée
  const covered = codes.some((c) => (c.length === 5 ? c === cp : cp.startsWith(c)));
  return covered ? { covered: true } : { covered: false, reason: "hors_zone" };
}
