// Gestion des dates dans le fuseau Europe/Paris, quel que soit le fuseau du serveur.

export const TIMEZONE = "Europe/Paris";

/** Décalage (ms) entre UTC et Europe/Paris pour un instant donné. */
function tzOffsetMs(utcDate: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(utcDate).map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - utcDate.getTime();
}

/** Convertit "2026-07-15" + "09:30" (heure de Paris) en Date UTC. */
export function parisTimeToUtc(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm, 0);
  // Deux passes pour gérer les changements d'heure.
  let offset = tzOffsetMs(new Date(naive));
  offset = tzOffsetMs(new Date(naive - offset));
  return new Date(naive - offset);
}

/** Renvoie {date: "2026-07-15", time: "09:30", weekday: 1..7} pour un instant UTC, vu de Paris. */
export function utcToParis(date: Date): { date: string; time: string; weekday: number } {
  const dtf = new Intl.DateTimeFormat("fr-FR", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const weekdays: Record<string, number> = { "lun.": 1, "mar.": 2, "mer.": 3, "jeu.": 4, "ven.": 5, "sam.": 6, "dim.": 7 };
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${String(Number(parts.hour) % 24).padStart(2, "0")}:${parts.minute}`,
    weekday: weekdays[parts.weekday] ?? 1,
  };
}

/** Format long lisible : "mercredi 15 juillet 2026" */
export function formatDateFr(date: Date | null): string {
  if (!date) return "date à définir";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** "09h30" */
export function formatTimeFr(date: Date | null): string {
  if (!date) return "";
  const { time } = utcToParis(date);
  return time.replace(":", "h");
}

export function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function todayParis(): string {
  return utcToParis(new Date()).date;
}
