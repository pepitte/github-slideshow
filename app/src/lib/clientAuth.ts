// Session des comptes particuliers (clients), séparée des espaces pro et admin.
// Le hachage de mot de passe est partagé avec proAuth.
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export { hashPassword, verifyPassword } from "./proAuth";

const CLIENT_COOKIE = "client_session";
const SESSION_DAYS = 90;

function secret(): string {
  return process.env.AUTH_SECRET || "dev-secret-a-changer";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createClientToken(clientId: string): string {
  const expires = Date.now() + SESSION_DAYS * 24 * 3600_000;
  const payload = Buffer.from(JSON.stringify({ clientId, expires })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function currentClientId(): string | null {
  const token = cookies().get(CLIENT_COOKIE)?.value;
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.expires === "number" && data.expires > Date.now()) return data.clientId;
  } catch {}
  return null;
}

export const CLIENT_COOKIE_NAME = CLIENT_COOKIE;
export const CLIENT_SESSION_MAX_AGE = SESSION_DAYS * 24 * 3600;
