import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { champsAgence } from "@/lib/agences";

export const dynamic = "force-dynamic";

// GET /api/admin/agences — les secteurs, avec le nombre de paysagistes rattachés.
export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const agences = await prisma.agence.findMany({
    orderBy: [{ ordre: "asc" }, { nom: "asc" }],
    include: { _count: { select: { pros: true } } },
  });
  return NextResponse.json({
    agences: agences.map(({ _count, ...a }) => ({ ...a, prosCount: _count.pros })),
  });
}

// POST /api/admin/agences — créer un secteur.
export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const data = champsAgence(body);
  if (!data.nom) {
    return NextResponse.json({ error: "Le nom du secteur est obligatoire." }, { status: 400 });
  }
  const agence = await prisma.agence.create({
    data: { ...data, nom: String(data.nom) },
  });
  return NextResponse.json({ agence }, { status: 201 });
}
