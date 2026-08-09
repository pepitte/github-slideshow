import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  createClientToken,
  CLIENT_COOKIE_NAME,
  CLIENT_SESSION_MAX_AGE,
} from "@/lib/clientAuth";
import { callerKey, blockedFor, registerFailure, registerSuccess } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// POST /api/client/login — connexion d'un particulier.
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const key = "client:" + callerKey(req);
  const wait = blockedFor(key);
  if (wait > 0) {
    return NextResponse.json(
      { error: `Trop de tentatives. Réessayez dans ${wait} minute${wait > 1 ? "s" : ""}.` },
      { status: 429 }
    );
  }
  const client = await prisma.client.findUnique({ where: { email } });
  if (!client || !verifyPassword(password, client.passwordHash)) {
    registerFailure(key);
    return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
  }
  registerSuccess(key);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CLIENT_COOKIE_NAME, createClientToken(client.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: CLIENT_SESSION_MAX_AGE,
    path: "/",
  });
  return res;
}
