// Authentification des professionnels : hachage de mot de passe (scrypt)
// et session signée (HMAC), séparée de la session admin.
import { createHmac, timingSafeEqual, scryptSync, randomBytes } from "crypto";
import { cookies } from "next/headers";

const PRO_COOKIE = "pro_session";
const SESSION_DAYS = 60;

function secret(): string {
  return process.env.AUTH_SECRET || "dev-secret-a-changer";
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${key}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const candidate = scryptSync(password, salt, 64).toString("hex");
  if (candidate.length !== key.length) return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(key));
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createProToken(proId: string): string {
  const expires = Date.now() + SESSION_DAYS * 24 * 3600_000;
  const payload = Buffer.from(JSON.stringify({ proId, expires })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function getProIdFromToken(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.expires === "number" && data.expires > Date.now()) return data.proId;
  } catch {}
  return null;
}

export function currentProId(): string | null {
  return getProIdFromToken(cookies().get(PRO_COOKIE)?.value);
}

export const PRO_COOKIE_NAME = PRO_COOKIE;
export const PRO_SESSION_MAX_AGE = SESSION_DAYS * 24 * 3600;

export const PRO_STATUSES = [
  "disponible_devis",
  "disponible_chantier",
  "sous_confirmation",
  "indisponible",
] as const;
