// Envoi d'emails via l'API Resend, avec pièce jointe .ics.
// Si Resend n'est pas configuré, l'email est journalisé en console (mode dev).

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export type EmailOptions = {
  to: string;
  subject: string;
  text: string;
  icsContent?: string;
  /** Expéditeur (réglable depuis l'admin). Vide = EMAIL_FROM, puis adresse d'essai Resend. */
  from?: string;
};

/** Adresse d'essai de Resend : n'écrit qu'au propriétaire du compte. */
export const EXPEDITEUR_ESSAI = "RDV <onboarding@resend.dev>";

/** Vrai tant qu'aucun domaine vérifié n'est configuré (emails clients bloqués). */
export function usingTestSender(settingsFrom?: string): boolean {
  return !(settingsFrom?.trim() || process.env.EMAIL_FROM || "").trim();
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  return (await sendEmailChecked(options)).ok;
}

/** Comme `sendEmail`, mais renvoie le motif du refus (bouton de test de l'admin). */
export async function sendEmailChecked(
  options: EmailOptions
): Promise<{ ok: boolean; simulated?: boolean; error?: string }> {
  if (!emailConfigured()) {
    console.log(`[Email simulé → ${options.to}] ${options.subject}\n${options.text}`);
    return { ok: true, simulated: true };
  }
  try {
    const body: Record<string, unknown> = {
      from: options.from?.trim() || process.env.EMAIL_FROM || EXPEDITEUR_ESSAI,
      to: [options.to],
      subject: options.subject,
      text: options.text,
    };
    if (options.icsContent) {
      body.attachments = [
        {
          filename: "rendez-vous.ics",
          content: Buffer.from(options.icsContent).toString("base64"),
          content_type: "text/calendar",
        },
      ];
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("Envoi email Resend échoué:", detail);
      let message = detail;
      try {
        message = JSON.parse(detail)?.message || detail;
      } catch {}
      return { ok: false, error: message };
    }
    return { ok: true };
  } catch (e) {
    console.error("Envoi email erreur réseau:", e);
    return { ok: false, error: "Le service d'envoi est injoignable." };
  }
}
