import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { changerStatut } from "@/lib/affaires";
import { ETAPE_PAR_ID, MOTIFS_PERTE } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

/** GET /api/admin/affaires/:id — le dossier complet. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const affaire = await prisma.affaire.findUnique({
    where: { id: params.id },
    include: {
      contact: true,
      agence: { select: { id: true, nom: true, couleur: true } },
      pro: { select: { id: true, name: true } },
      bookings: {
        orderBy: { startAt: "asc" },
        select: { id: true, kind: true, startAt: true, endAt: true, status: true, city: true },
      },
      documents: {
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, number: true, status: true, date: true, itemsJson: true, vatRate: true },
      },
    },
  });
  if (!affaire) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  return NextResponse.json({ affaire });
}

/**
 * PATCH /api/admin/affaires/:id — étape, motif de perte, montant, date de
 * prochaine action, paysagiste responsable, intitulé.
 */
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
  const existe = await prisma.affaire.findUnique({ where: { id: params.id } });
  if (!existe) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  // Changement d'étape : passe par la fonction dédiée, qui journalise.
  if (typeof body.statut === "string" && body.statut !== existe.statut) {
    const statut = body.statut;
    if (!ETAPE_PAR_ID[statut]) {
      return NextResponse.json({ error: "Étape inconnue" }, { status: 400 });
    }
    const motif = String(body.motifPerte ?? existe.motifPerte ?? "");
    if (statut === "perdu" && !MOTIFS_PERTE[motif]) {
      return NextResponse.json(
        { error: "Indiquez pourquoi l'affaire est perdue.", besoinMotif: true },
        { status: 400 }
      );
    }
    await changerStatut(params.id, statut, { motifPerte: motif });
  }

  const data: Record<string, unknown> = {};
  for (const c of ["intitule", "description", "address", "postalCode", "city", "projectType"]) {
    if (typeof body[c] === "string") data[c] = String(body[c]).trim().slice(0, 2000);
  }
  if (body.montant !== undefined) {
    const n = Number(body.montant);
    data.montant = Number.isFinite(n) && n >= 0 ? n : null;
  }
  if (body.prochaineActionAt !== undefined) {
    const v = String(body.prochaineActionAt ?? "").trim();
    data.prochaineActionAt = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T09:00:00Z`) : null;
  }
  if (body.proId !== undefined) {
    const brut = String(body.proId ?? "").trim();
    data.proId = brut && (await prisma.pro.findUnique({ where: { id: brut } })) ? brut : null;
  }
  if (body.motifPerte !== undefined && typeof body.statut !== "string") {
    const m = String(body.motifPerte ?? "");
    data.motifPerte = MOTIFS_PERTE[m] ? m : "";
  }

  const affaire = Object.keys(data).length
    ? await prisma.affaire.update({ where: { id: params.id }, data })
    : await prisma.affaire.findUnique({ where: { id: params.id } });
  return NextResponse.json({ ok: true, affaire });
}

/** DELETE /api/admin/affaires/:id — supprimer une affaire créée par erreur. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    await prisma.affaire.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }
}
