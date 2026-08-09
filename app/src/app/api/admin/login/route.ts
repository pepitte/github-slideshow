import { NextRequest, NextResponse } from "next/server";
import { checkCredentials, createSessionToken, ADMIN_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { callerKey, blockedFor, registerFailure, registerSuccess } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const key = "admin:" + callerKey(req);
  const wait = blockedFor(key);
  if (wait > 0) {
    return NextResponse.json(
      { error: `Trop de tentatives. Réessayez dans ${wait} minute${wait > 1 ? "s" : ""}.` },
      { status: 429 }
    );
  }
  if (!checkCredentials(body.email ?? "", body.password ?? "")) {
    registerFailure(key);
    return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
  }
  registerSuccess(key);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, createSessionToken(body.email!), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return res;
}
