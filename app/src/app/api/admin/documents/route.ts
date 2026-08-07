import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { cleanItems, parisToday } from "@/lib/documents";

export const dynamic = "force-dynamic";

// GET /api/admin/documents — tous les devis et factures, plus récents d'abord.
export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const documents = await prisma.document.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ documents });
}

// POST /api/admin/documents { type, ... } — crée un document avec un numéro
// automatique unique : D-2026-001 pour un devis, F-2026-001 pour une facture.
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
  const type = body.type === "facture" ? "facture" : "devis";
  const year = parisToday().slice(0, 4);
  const prefix = `${type === "devis" ? "D" : "F"}-${year}-`;
  const count = await prisma.document.count({ where: { number: { startsWith: prefix } } });

  // En cas de collision (créations simultanées), on retente avec le numéro suivant.
  for (let attempt = 0; attempt < 5; attempt++) {
    const number = `${prefix}${String(count + 1 + attempt).padStart(3, "0")}`;
    try {
      const document = await prisma.document.create({
        data: {
          type,
          number,
          date: parisToday(),
          clientName: String(body.clientName ?? "").slice(0, 200),
          clientAddress: String(body.clientAddress ?? "").slice(0, 300),
          clientEmail: String(body.clientEmail ?? "").slice(0, 200),
          clientPhone: String(body.clientPhone ?? "").slice(0, 30),
          itemsJson: JSON.stringify(cleanItems(body.items)),
          vatRate: [0, 10, 20].includes(Number(body.vatRate)) ? Number(body.vatRate) : 20,
          notes: String(body.notes ?? "").slice(0, 3000),
          status: type === "facture" ? "a_payer" : "brouillon",
        },
      });
      return NextResponse.json({ ok: true, document }, { status: 201 });
    } catch {
      // numéro déjà pris → tentative suivante
    }
  }
  return NextResponse.json({ error: "Numérotation impossible, réessayez" }, { status: 500 });
}
