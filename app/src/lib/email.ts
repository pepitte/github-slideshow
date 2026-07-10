// Envoi d'emails via l'API Resend, avec pièce jointe .ics.
// Si Resend n'est pas configuré, l'email est journalisé en console (mode dev).

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  icsContent?: string;
}): Promise<boolean> {
  if (!emailConfigured()) {
    console.log(`[Email simulé → ${options.to}] ${options.subject}\n${options.text}`);
    return true;
  }
  try {
    const body: Record<string, unknown> = {
      from: process.env.EMAIL_FROM || "RDV <onboarding@resend.dev>",
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
      console.error("Envoi email Resend échoué:", await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("Envoi email erreur réseau:", e);
    return false;
  }
}
