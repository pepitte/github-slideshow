import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

// PATCH /api/admin/pros/:id { agenceId } — rattacher un paysagiste à un
// secteur (ou l'en détacher avec une valeur vide).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {}
  if (body.agenceId === undefined) {
    return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });
  }
  const brut = String(body.agenceId ?? "").trim();
  const agenceId = brut
    ? ((await prisma.agence.findUnique({ where: { id: brut } })) ? brut : null)
    : null;
  try {
    const pro = await prisma.pro.update({ where: { id: params.id }, data: { agenceId } });
    return NextResponse.json({ ok: true, agenceId: pro.agenceId });
  } catch {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }
}

// DELETE /api/admin/pros/:id — retire un professionnel (ses pointages suivent).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    await prisma.pro.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }
}
