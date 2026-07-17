import type { Booking, Settings } from "@prisma/client";
import { formatDateFr, formatTimeFr } from "./dates";

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Remplace les variables {{...}} d'un modèle de message. */
export function renderTemplate(template: string, booking: Booking, settings: Settings): string {
  const vars: Record<string, string> = {
    prenom: booking.firstName,
    nom: booking.lastName,
    date: formatDateFr(booking.startAt),
    heure: formatTimeFr(booking.startAt),
    adresse: `${booking.address}, ${booking.postalCode} ${booking.city}`.trim(),
    entreprise: settings.companyName,
    telephone: settings.companyPhone,
    lien_annulation: `${appUrl()}/annuler/${booking.cancelToken}`,
  };
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? "");
}
