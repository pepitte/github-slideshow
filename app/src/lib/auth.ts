import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "admin_session";
const SESSION_HOURS = 24 * 7;

function secret(): string {
  return process.env.AUTH_SECRET || "dev-secret-a-changer";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createSessionToken(email: string): string {
  const expires = Date.now() + SESSION_HOURS * 3600_000;
  const payload = Buffer.from(JSON.stringify({ email, expires })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = sign(payload);
  if (sig.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof data.expires === "number" && data.expires > Date.now();
  } catch {
    return false;
  }
}

export function isAdminAuthenticated(): boolean {
  return verifySessionToken(cookies().get(COOKIE_NAME)?.value);
}

export function checkCredentials(email: string, password: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL || "";
  const adminPassword = process.env.ADMIN_PASSWORD || "";
  if (!adminEmail || !adminPassword) return false;
  return email.trim().toLowerCase() === adminEmail.toLowerCase() && password === adminPassword;
}

export const ADMIN_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE = SESSION_HOURS * 3600;
