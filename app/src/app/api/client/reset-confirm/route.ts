import { NextRequest, NextResponse } from "next/server";
import { confirmPasswordReset } from "@/lib/passwordReset";

export const dynamic = "force-dynamic";

// POST — applique le nouveau mot de passe si le lien (jeton) est valide.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  if (password.length < 6) {
    return NextResponse.json({ error: "Mot de passe : 6 caractères minimum" }, { status: 400 });
  }
  const ok = await confirmPasswordReset("client", token, password);
  if (!ok) {
    return NextResponse.json({ error: "lien_invalide" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
