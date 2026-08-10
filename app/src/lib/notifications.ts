// Orchestration des notifications liées à un RDV.
import type { Booking, Pro, Settings } from "@prisma/client";
import { sendSms } from "./sms";
import { sendEmail, sendEmailChecked } from "./email";
import { buildIcs } from "./ics";
import { renderTemplate } from "./templates";
import { formatDateFr, formatTimeFr } from "./dates";

// Adresse d'exemple livrée par défaut : ne jamais lui envoyer d'alerte.
const EMAIL_EXEMPLE = "contact@example.com";

/** Adresse du gérant : réglage dédié, sinon email de l'entreprise, sinon compte admin. */
export function ownerEmailOf(settings: Settings): string {
  const company = settings.companyEmail === EMAIL_EXEMPLE ? "" : settings.companyEmail;
  return settings.ownerEmail || company || process.env.ADMIN_EMAIL || "";
}

export function ownerPhoneOf(settings: Settings): string {
  return settings.ownerPhone || settings.companyPhone || "";
}

/** Expéditeur des emails : réglage de l'admin, sinon variable d'environnement. */
export function expediteurOf(settings: Settings): string {
  return settings.emailFrom.trim();
}

const PROJECT_LABELS: Record<string, string> = {
  entretien: "Entretien de jardin général",
  taille_haie: "Taille de haie",
  debroussaillage: "Débroussaillage",
  contrat_annuel: "Contrat d'entretien à l'année",
  autre: "Autre projet",
};

/** Quand a lieu le RDV, en clair (chantier multi-jours : « du … au … »). */
function whenLabel(booking: Booking, groupDates?: Date[]): string {
  if (groupDates && groupDates.length > 1) {
    return `du ${formatDateFr(groupDates[0])} au ${formatDateFr(groupDates[groupDates.length - 1])}`;
  }
  const heure = formatTimeFr(booking.startAt);
  return `${formatDateFr(booking.startAt)}${heure ? ` à ${heure}` : ""}`;
}

/**
 * Alerte le gérant dès qu'un client réserve : email (et SMS si activé), pour
 * ne plus avoir à ouvrir le tableau de bord. Destinataires : ceux des réglages,
 * sinon les coordonnées de l'entreprise, sinon l'email de connexion admin.
 */
export async function notifyOwnerNewBooking(
  booking: Booking,
  settings: Settings,
  groupDates?: Date[],
  proLabel?: string,
  confirmation?: ConfirmationResult
): Promise<void> {
  const quand = whenLabel(booking, groupDates);
  const type = booking.kind === "chantier" ? "chantier" : "devis";
  const client = `${booking.firstName} ${booking.lastName}`.trim() || "Client sans nom";
  const lieu = [booking.address, `${booking.postalCode} ${booking.city}`.trim()]
    .filter(Boolean)
    .join(", ");
  const tasks: Promise<unknown>[] = [];

  if (settings.notifyOwnerEmail) {
    const to = ownerEmailOf(settings);
    if (to) {
      tasks.push(
        sendEmail({
          to,
          from: expediteurOf(settings),
          subject: `Nouveau RDV ${type} — ${client} (${quand})`,
          text: [
            `Nouvelle réservation sur votre site :`,
            ``,
            `Type       : ${type === "chantier" ? "Chantier" : "Visite devis"}`,
            `Quand      : ${quand}`,
            `Client     : ${client}`,
            `Téléphone  : ${booking.phone || "—"}`,
            `Email      : ${booking.email || "—"}`,
            `Adresse    : ${lieu || "—"}`,
            `Projet     : ${PROJECT_LABELS[booking.projectType] ?? booking.projectType}`,
            proLabel ? `Attribué à : ${proLabel}` : "",
            booking.description ? `Message    : ${booking.description}` : "",
            ``,
            // Le client croit avoir reçu une confirmation : si elle n'est pas
            // partie, il faut le savoir tout de suite pour le rappeler.
            confirmation && !confirmation.emailOk
              ? `/!\\ L'EMAIL DE CONFIRMATION AU CLIENT N'EST PAS PARTI (${confirmation.emailError ?? "motif inconnu"}).\n    Pensez à le contacter. Réglage : Paramètres > Emails envoyés aux clients.\n`
              : "",
            `Retrouvez ce rendez-vous dans votre tableau de bord.`,
          ]
            .filter(Boolean)
            .join("\n"),
        })
      );
    }
  }
  if (settings.notifyOwnerSms) {
    const to = ownerPhoneOf(settings);
    if (to) {
      tasks.push(
        sendSms(
          to,
          `Nouveau RDV ${type} : ${client}, ${quand}${lieu ? `, ${lieu}` : ""}. Tel ${booking.phone || "—"}.`
        )
      );
    }
  }
  await Promise.allSettled(tasks);
}

/** Formatte une liste de jours AAAA-MM-JJ en français court. */
function joursFr(days: string[]): string {
  return days
    .map((d) =>
      new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    )
    .join(", ");
}

/**
 * Prévient un professionnel qu'un chantier vient de lui être attribué
 * (email ; le détail complet est dans son espace, téléphone du client compris).
 */
export async function notifyProNewChantier(
  pro: Pro,
  booking: Booking,
  days: string[],
  settings: Settings
): Promise<void> {
  if (!pro.email) return;
  const client = `${booking.firstName} ${booking.lastName}`.trim();
  const lieu = [booking.address, `${booking.postalCode} ${booking.city}`.trim()]
    .filter(Boolean)
    .join(", ");
  await sendEmail({
    to: pro.email,
    from: expediteurOf(settings),
    subject: `Nouveau chantier : ${joursFr(days)} — ${booking.city || booking.postalCode}`,
    text: [
      `Bonjour ${pro.name},`,
      ``,
      `Un chantier vient de vous être attribué :`,
      ``,
      `Quand      : ${joursFr(days)}, à partir de 8h00`,
      `Client     : ${client}`,
      `Adresse    : ${lieu}`,
      `Projet     : ${PROJECT_LABELS[booking.projectType] ?? booking.projectType}`,
      booking.description ? `Détails    : ${booking.description}` : "",
      ``,
      `Retrouvez le téléphone du client et l'itinéraire dans votre espace professionnel.`,
      `Un empêchement ? Utilisez le bouton « Je ne peux pas » dans votre espace : le chantier sera réattribué.`,
      ``,
      settings.companyName,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

/**
 * Prévient un professionnel qu'une visite devis vient de lui être attribuée.
 */
export async function notifyProNewDevis(
  pro: Pro,
  booking: Booking,
  settings: Settings
): Promise<void> {
  if (!pro.email || !booking.startAt) return;
  const client = `${booking.firstName} ${booking.lastName}`.trim();
  const lieu = [booking.address, `${booking.postalCode} ${booking.city}`.trim()]
    .filter(Boolean)
    .join(", ");
  const quand = `${formatDateFr(booking.startAt)} à ${formatTimeFr(booking.startAt)}`;
  await sendEmail({
    to: pro.email,
    from: expediteurOf(settings),
    subject: `Nouvelle visite devis : ${quand} — ${booking.city || booking.postalCode}`,
    text: [
      `Bonjour ${pro.name},`,
      ``,
      `Une visite devis vient de vous être attribuée :`,
      ``,
      `Quand      : ${quand} (30 minutes)`,
      `Client     : ${client}`,
      `Adresse    : ${lieu}`,
      booking.description ? `Projet     : ${booking.description}` : "",
      ``,
      `Retrouvez le téléphone du client et l'itinéraire dans votre espace professionnel.`,
      `Si le devis est accepté, le chantier vous sera proposé en priorité.`,
      `Un empêchement ? Bouton « Je ne peux pas » dans votre espace.`,
      ``,
      settings.companyName,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

/**
 * Prévient le gérant qu'un chantier a changé de mains (désistement) ou reste
 * sans professionnel.
 */
export async function notifyOwnerReassign(
  settings: Settings,
  booking: Booking,
  ancien: Pro,
  nouveau: Pro | null
): Promise<void> {
  const to = ownerEmailOf(settings);
  if (!to) return;
  const quand = whenLabel(booking);
  await sendEmail({
    to,
    from: expediteurOf(settings),
    subject: nouveau
      ? `${booking.kind === "devis" ? "Visite devis réattribuée" : "Chantier réattribué"} : ${quand}`
      : `${booking.kind === "devis" ? "Visite devis SANS professionnel" : "Chantier SANS professionnel"} : ${quand}`,
    text: [
      `${ancien.name} s'est désisté ${booking.kind === "devis" ? "de la visite devis" : "du chantier"} du ${quand}`,
      `(${booking.address}, ${booking.postalCode} ${booking.city}).`,
      ``,
      nouveau
        ? `Réattribution automatique à ${nouveau.name}.`
        : booking.kind === "devis"
          ? `Aucun autre professionnel disponible : la visite reste à votre charge ou à réattribuer depuis le tableau de bord.`
          : `Aucun autre professionnel disponible : le chantier est À ATTRIBUER depuis votre tableau de bord.`,
    ].join("\n"),
  });
}

/** Résultat de la confirmation au client, pour pouvoir alerter le gérant. */
export type ConfirmationResult = { emailOk: boolean; emailError?: string };

/** SMS + email de confirmation, envoyés immédiatement après la réservation.
 *  `groupDates` : chantier multi-jours ({{date}} devient « du … au … »).
 *  Renvoie l'issue de l'email : tant qu'aucun domaine n'est vérifié chez
 *  Resend, il est refusé et le gérant doit le savoir. */
export async function sendConfirmation(
  booking: Booking,
  settings: Settings,
  groupDates?: Date[]
): Promise<ConfirmationResult> {
  const smsBody = renderTemplate(settings.smsConfirmation, booking, settings, groupDates);
  const emailSubject = renderTemplate(settings.emailSubject, booking, settings, groupDates);
  const emailBody = renderTemplate(settings.emailBody, booking, settings, groupDates);
  const [, email] = await Promise.all([
    sendSms(booking.phone, smsBody).catch(() => false),
    booking.email
      ? sendEmailChecked({
          to: booking.email,
          from: expediteurOf(settings),
          subject: emailSubject,
          text: emailBody,
          icsContent: buildIcs(booking, settings),
        }).catch((e) => ({ ok: false, error: String(e) }))
      : Promise.resolve({ ok: false, error: "aucune adresse email" }),
  ]);
  return { emailOk: email.ok, emailError: email.ok ? undefined : email.error };
}

/**
 * Alerte le gérant dès qu'un prospect arrive d'une publicité Meta : c'est un
 * contact à rappeler vite, il ne doit pas dormir dans le tableau de bord.
 */
export async function notifyOwnerNewLead(
  lead: {
    name: string;
    phone: string;
    email: string;
    postalCode: string;
    message: string;
    formName: string;
    adName: string;
    campaign: string;
    source: string;
  },
  settings: Settings
): Promise<void> {
  const origine = lead.source === "meta" ? "publicité Facebook/Instagram" : "formulaire du site";
  const tasks: Promise<unknown>[] = [];

  if (settings.notifyOwnerEmail) {
    const to = ownerEmailOf(settings);
    if (to) {
      tasks.push(
        sendEmail({
          to,
          from: expediteurOf(settings),
          subject: `Nouveau prospect — ${lead.name}${lead.postalCode ? ` (${lead.postalCode})` : ""}`,
          text: [
            `Nouveau prospect à rappeler (${origine}) :`,
            ``,
            `Nom        : ${lead.name}`,
            `Téléphone  : ${lead.phone || "—"}`,
            `Email      : ${lead.email || "—"}`,
            `Code postal: ${lead.postalCode || "—"}`,
            lead.message ? `Message    : ${lead.message}` : "",
            lead.campaign ? `Campagne   : ${lead.campaign}` : "",
            lead.adName ? `Publicité  : ${lead.adName}` : "",
            lead.formName ? `Formulaire : ${lead.formName}` : "",
            ``,
            `Retrouvez-le dans votre espace, section Publicités Meta.`,
          ]
            .filter(Boolean)
            .join("\n"),
        })
      );
    }
  }
  if (settings.notifyOwnerSms) {
    const to = ownerPhoneOf(settings);
    if (to) {
      tasks.push(
        sendSms(to, `Nouveau prospect ${lead.name}${lead.phone ? ` — ${lead.phone}` : ""} (${origine}).`)
      );
    }
  }
  await Promise.allSettled(tasks);
}

export async function sendReminder24h(booking: Booking, settings: Settings): Promise<boolean> {
  return sendSms(booking.phone, renderTemplate(settings.smsReminder24h, booking, settings));
}

export async function sendReminder1h(booking: Booking, settings: Settings): Promise<boolean> {
  return sendSms(booking.phone, renderTemplate(settings.smsReminder1h, booking, settings));
}
