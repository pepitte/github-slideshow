import { prisma } from "./prisma";
import type { Settings } from "@prisma/client";

export type OpeningHours = Record<
  string,
  { enabled: boolean; start: string; end: string }
>;

export type DayOff = { from: string; to: string; label?: string };

export const DEFAULT_OPENING_HOURS: OpeningHours = {
  "1": { enabled: true, start: "16:30", end: "20:00" },
  "2": { enabled: true, start: "16:30", end: "20:00" },
  "3": { enabled: true, start: "16:30", end: "20:00" },
  "4": { enabled: true, start: "16:30", end: "20:00" },
  "5": { enabled: true, start: "16:30", end: "20:00" },
  "6": { enabled: false, start: "09:00", end: "12:00" },
  "7": { enabled: false, start: "09:00", end: "12:00" },
};

// Chantiers : le matin à partir de 8h, en journée.
export const DEFAULT_CHANTIER_HOURS: OpeningHours = {
  "1": { enabled: true, start: "08:00", end: "18:00" },
  "2": { enabled: true, start: "08:00", end: "18:00" },
  "3": { enabled: true, start: "08:00", end: "18:00" },
  "4": { enabled: true, start: "08:00", end: "18:00" },
  "5": { enabled: true, start: "08:00", end: "18:00" },
  "6": { enabled: false, start: "08:00", end: "12:00" },
  "7": { enabled: false, start: "08:00", end: "12:00" },
};

export const DEFAULT_SMS_CONFIRMATION =
  "Bonjour {{prenom}}, votre RDV devis avec {{entreprise}} est confirmé le {{date}} à {{heure}} au {{adresse}}. Question ou imprévu ? {{telephone}}. Annuler/reporter : {{lien_annulation}}";
export const DEFAULT_SMS_24H =
  "Rappel : votre RDV devis {{entreprise}} a lieu demain, le {{date}} à {{heure}} ({{adresse}}). Pour annuler/reporter : {{lien_annulation}}";
export const DEFAULT_SMS_1H =
  "Votre RDV devis {{entreprise}} a lieu dans 1 h, à {{heure}}. À tout à l'heure ! Contact : {{telephone}}";
export const DEFAULT_EMAIL_SUBJECT = "Confirmation de votre RDV devis — {{entreprise}}";
export const DEFAULT_EMAIL_BODY =
  "Bonjour {{prenom}},\n\nVotre rendez-vous pour l'établissement d'un devis est confirmé :\n\n{{date}} à {{heure}}\n{{adresse}}\n\nVous trouverez en pièce jointe une invitation à ajouter à votre calendrier.\n\nPour annuler ou reporter : {{lien_annulation}}\n\nÀ bientôt,\n{{entreprise}} — {{telephone}}";

export async function getSettings(): Promise<Settings> {
  return prisma.settings.upsert({
    where: { id: "main" },
    update: {},
    create: {
      id: "main",
      openingHoursJson: JSON.stringify(DEFAULT_OPENING_HOURS),
      smsConfirmation: DEFAULT_SMS_CONFIRMATION,
      smsReminder24h: DEFAULT_SMS_24H,
      smsReminder1h: DEFAULT_SMS_1H,
      emailSubject: DEFAULT_EMAIL_SUBJECT,
      emailBody: DEFAULT_EMAIL_BODY,
    },
  });
}

export function parseOpeningHours(s: Settings): OpeningHours {
  try {
    const parsed = JSON.parse(s.openingHoursJson);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {}
  return DEFAULT_OPENING_HOURS;
}

export function parseChantierHours(s: Settings): OpeningHours {
  try {
    const parsed = JSON.parse(s.chantierHoursJson);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {}
  return DEFAULT_CHANTIER_HOURS;
}

export function parseDaysOff(s: Settings): DayOff[] {
  try {
    const parsed = JSON.parse(s.daysOffJson);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

export function parsePostalCodes(s: Settings): string[] {
  try {
    const parsed = JSON.parse(s.postalCodesJson);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}
  return [];
}
