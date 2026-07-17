// Envoi de SMS via l'API REST Twilio (aucun SDK nécessaire).
// Si Twilio n'est pas configuré, le SMS est journalisé en console (mode dev).

export function smsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
  );
}

/** Normalise un numéro FR en E.164 (+33...). */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (/^0\d{9}$/.test(digits)) return `+33${digits.slice(1)}`;
  return digits;
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  const toE164 = normalizePhone(to);
  if (!smsConfigured()) {
    console.log(`[SMS simulé → ${toE164}] ${body}`);
    return true;
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: toE164,
        From: process.env.TWILIO_FROM_NUMBER!,
        Body: body,
      }),
    });
    if (!res.ok) {
      console.error("Envoi SMS Twilio échoué:", await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("Envoi SMS erreur réseau:", e);
    return false;
  }
}
