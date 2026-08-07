import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { cleanItems } from "@/lib/documents";

export const dynamic = "force-dynamic";

const STATUSES = ["brouillon", "envoye", "accepte", "refuse", "a_payer", "payee"];

// GET /api/admin/documents/:id — un devis ou une facture.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const document = await prisma.document.findUnique({ where: { id: params.id } });
  if (!document) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  return NextResponse.json({ document });
}

// PATCH /api/admin/documents/:id — met à jour le contenu du document.
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
  const data: Record<string, unknown> = {};
  if (body.clientName !== undefined) data.clientName = String(body.clientName).slice(0, 200);
  if (body.clientAddress !== undefined) data.clientAddress = String(body.clientAddress).slice(0, 300);
  if (body.clientEmail !== undefined) data.clientEmail = String(body.clientEmail).slice(0, 200);
  if (body.clientPhone !== undefined) data.clientPhone = String(body.clientPhone).slice(0, 30);
  if (body.items !== undefined) data.itemsJson = JSON.stringify(cleanItems(body.items));
  if (body.vatRate !== undefined && [0, 10, 20].includes(Number(body.vatRate))) {
    data.vatRate = Number(body.vatRate);
  }
  if (body.notes !== undefined) data.notes = String(body.notes).slice(0, 3000);
  if (body.date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(String(body.date))) {
    data.date = String(body.date);
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(String(body.status))) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }
    data.status = String(body.status);
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400 });
  }
  try {
    const document = await prisma.document.update({ where: { id: params.id }, data });
    return NextResponse.json({ ok: true, document });
  } catch {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }
}

// DELETE /api/admin/documents/:id — supprime un document.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    await prisma.document.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }
}
