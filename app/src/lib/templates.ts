import type { Booking, Settings } from "@prisma/client";
import { formatDateFr, formatTimeFr } from "./dates";

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Remplace les variables {{...}} d'un modèle de message.
 *  `groupDates` (chantier multi-jours) : {{date}} devient « du … au … (N jours) ». */
export function renderTemplate(
  template: string,
  booking: Booking,
  settings: Settings,
  groupDates?: Date[]
): string {
  let dateLabel = formatDateFr(booking.startAt);
  if (groupDates && groupDates.length > 1) {
    const sorted = [...groupDates].sort((a, b) => a.getTime() - b.getTime());
    dateLabel = `du ${formatDateFr(sorted[0])} au ${formatDateFr(sorted[sorted.length - 1])} (${sorted.length} jours)`;
    // Évite « le du mardi… » : les modèles écrivent « le {{date}} ».
    template = template.replace(/\b[lL]e\s+(\{\{\s*date\s*\}\})/g, "$1");
  }
  const vars: Record<string, string> = {
    prenom: booking.firstName,
    nom: booking.lastName,
    date: dateLabel,
    heure: formatTimeFr(booking.startAt),
    adresse: `${booking.address}, ${booking.postalCode} ${booking.city}`.trim(),
    entreprise: settings.companyName,
    telephone: settings.companyPhone,
    lien_annulation: `${appUrl()}/annuler/${booking.cancelToken}`,
  };
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? "");
}
