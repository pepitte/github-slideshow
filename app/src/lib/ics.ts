// Génération d'un fichier .ics (invitation calendrier) : pièce jointe de l'email
// de confirmation et bouton « Ajouter à mon agenda » dans l'espace client.
import type { Booking, Settings } from "@prisma/client";

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function vevent(booking: Booking, settings: Settings): string[] {
  const location = `${booking.address}, ${booking.postalCode} ${booking.city}`;
  const chantier = booking.kind === "chantier";
  const titre = chantier ? "Chantier" : "Visite pour devis";
  return [
    "BEGIN:VEVENT",
    `UID:${booking.id}@rdv-devis`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(booking.startAt!)}`,
    `DTEND:${icsDate(booking.endAt!)}`,
    `SUMMARY:${escapeIcs(`${titre} — ${settings.companyName}`)}`,
    `LOCATION:${escapeIcs(location)}`,
    `DESCRIPTION:${escapeIcs(
      `${
        chantier
          ? "Intervention de nos paysagistes chez vous."
          : "Rendez-vous pour l'établissement d'un devis."
      }\nContact : ${settings.companyPhone}`
    )}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
  ];
}

/** Un rendez-vous. Chaîne vide si la date n'est pas encore fixée. */
export function buildIcs(booking: Booking, settings: Settings): string {
  if (!booking.startAt || !booking.endAt) return ""; // pas d'invitation sans date
  return buildIcsGroup([booking], settings);
}

/** Plusieurs rendez-vous dans un seul fichier : chantier réservé sur N jours. */
export function buildIcsGroup(bookings: Booking[], settings: Settings): string {
  const dates = bookings.filter((b) => b.startAt && b.endAt);
  if (!dates.length) return "";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${escapeIcs(settings.companyName)}//RDV Devis//FR`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...dates.flatMap((b) => vevent(b, settings)),
    "END:VCALENDAR",
  ].join("\r\n");
}
