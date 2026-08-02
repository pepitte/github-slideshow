import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  createProToken,
  PRO_COOKIE_NAME,
  PRO_SESSION_MAX_AGE,
} from "@/lib/proAuth";

export const dynamic = "force-dynamic";

// POST /api/pro/register — inscription libre d'un professionnel.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const phone = String(body.phone ?? "").trim();

  if (!name || !/.+@.+\..+/.test(email) || password.length < 6) {
    return NextResponse.json(
      { error: "Nom, email valide et mot de passe (6 caractères min) requis" },
      { status: 400 }
    );
  }
  const existing = await prisma.pro.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "email_existe" }, { status: 409 });
  }
  const pro = await prisma.pro.create({
    data: { name, email, phone, passwordHash: hashPassword(password) },
  });
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
