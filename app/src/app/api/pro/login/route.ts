import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  createProToken,
  PRO_COOKIE_NAME,
  PRO_SESSION_MAX_AGE,
} from "@/lib/proAuth";

export const dynamic = "force-dynamic";

// POST /api/pro/login — connexion d'un professionnel.
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const pro = await prisma.pro.findUnique({ where: { email } });
  if (!pro || !verifyPassword(password, pro.passwordHash)) {
    return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PRO_COOKIE_NAME, createProToken(pro.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PRO_SESSION_MAX_AGE,
    path: "/",
  });
  return res;
}
