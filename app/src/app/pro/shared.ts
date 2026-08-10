// Types et aides partagés entre les pages de l'espace professionnel.

export type Mission = {
  id: string;
  day: string;
  startAt: string;
  endAt: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  projectType: string;
  description: string;
};

export type EquipeJour = { id: string; day: string; city: string; proName: string };

export const PROJET_LABELS: Record<string, string> = {
  entretien: "Entretien de jardin",
  taille_haie: "Taille de haie",
  debroussaillage: "Débroussaillage",
  contrat_annuel: "Contrat d'entretien",
  autre: "Autre projet",
};

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function heureParis(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })
    .replace(":", "h");
}

export function labelJour(day: string, today: string): string {
  if (day === today) return "Aujourd'hui";
  const date = new Date(`${day}T12:00:00`);
  const demain = new Date(`${today}T12:00:00`);
  demain.setDate(demain.getDate() + 1);
  const label = date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  if (day === ymd(demain)) return `Demain — ${label}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function heuresLabel(minutes: number): string {
  return `${Math.floor(minutes / 60)}h${minutes % 60 ? String(minutes % 60).padStart(2, "0") : ""}`;
}

export function itineraireUrl(m: Mission): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${m.address}, ${m.postalCode} ${m.city}`
  )}`;
}

/** Message de confirmation avant désistement. */
export function confirmDecline(m: Mission, today: string): boolean {
  return window.confirm(
    `Vous ne pouvez pas assurer le chantier du ${labelJour(m.day, today).toLowerCase()} ?\nIl sera proposé à un autre professionnel et le gérant sera prévenu.`
  );
}
