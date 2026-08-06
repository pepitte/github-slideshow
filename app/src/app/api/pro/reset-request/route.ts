import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/passwordReset";

export const dynamic = "force-dynamic";

// POST — demande de réinitialisation. Répond toujours ok (ne révèle pas
// si un compte existe pour cet email).
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  if (/.+@.+\..+/.test(email)) {
    await requestPasswordReset("pro", email);
  }
  return NextResponse.json({ ok: true });
}
