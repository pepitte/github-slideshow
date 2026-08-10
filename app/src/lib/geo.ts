// Distances entre codes postaux, sans service externe : table embarquée
// des codes postaux français (position moyenne des communes partageant le code).
// Précision de l'ordre du kilomètre — suffisant pour « quel pro est le plus proche ».
import table from "./data/cp-gps.json";

const CP_GPS = table as unknown as Record<string, [number, number]>;

export function cpToLatLng(postalCode: string): { lat: number; lng: number } | null {
  const cp = (postalCode || "").trim().padStart(5, "0");
  const hit = CP_GPS[cp];
  return hit ? { lat: hit[0], lng: hit[1] } : null;
}

/** Distance à vol d'oiseau en kilomètres (formule de haversine). */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
