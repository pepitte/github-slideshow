// Orchestration des notifications liées à un RDV.
import type { Booking, Settings } from "@prisma/client";
import { sendSms } from "./sms";
import { sendEmail } from "./email";
import { buildIcs } from "./ics";
import { renderTemplate } from "./templates";

/** SMS + email de confirmation, envoyés immédiatement après la réservation.
 *  `groupDates` : chantier multi-jours ({{date}} devient « du … au … »). */
export async function sendConfirmation(
  booking: Booking,
  settings: Settings,
  groupDates?: Date[]
): Promise<void> {
  const smsBody = renderTemplate(settings.smsConfirmation, booking, settings, groupDates);
  const emailSubject = renderTemplate(settings.emailSubject, booking, settings, groupDates);
  const emailBody = renderTemplate(settings.emailBody, booking, settings, groupDates);
  await Promise.allSettled([
    sendSms(booking.phone, smsBody),
    sendEmail({
      to: booking.email,
      subject: emailSubject,
      text: emailBody,
      icsContent: buildIcs(booking, settings),
    }),
  ]);
}

export async function sendReminder24h(booking: Booking, settings: Settings): Promise<boolean> {
  return sendSms(booking.phone, renderTemplate(settings.smsReminder24h, booking, settings));
}

export async function sendReminder1h(booking: Booking, settings: Settings): Promise<boolean> {
  return sendSms(booking.phone, renderTemplate(settings.smsReminder1h, booking, settings));
}
