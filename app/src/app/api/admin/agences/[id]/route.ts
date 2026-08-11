import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { champsAgence } from "@/lib/agences";

export const dynamic = "force-dynamic";

// PATCH /api/admin/agences/:id — modifier un secteur.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const existe = await prisma.agence.findUnique({ where: { id: params.id } });
  if (!existe) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const agence = await prisma.agence.update({
    where: { id: params.id },
    data: champsAgence(body),
  });
  return NextResponse.json({ agence });
}

// DELETE /api/admin/agences/:id — supprimer un secteur.
// Les paysagistes rattachés ne sont PAS supprimés : ils sont simplement
// détachés (agenceId repasse à null).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const existe = await prisma.agence.findUnique({ where: { id: params.id } });
  if (!existe) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  await prisma.agence.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
