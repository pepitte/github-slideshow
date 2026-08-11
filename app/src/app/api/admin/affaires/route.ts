import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { creerAffaire } from "@/lib/affaires";
import { ETAPE_PAR_ID, estActive } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

const MAX_RESULTATS = 300;

/**
 * GET /api/admin/affaires?vue=actives|toutes&q=&agence=&statut= — le pipeline.
 * Par défaut on ne renvoie que les affaires vivantes : c'est ce que le gérant
 * regarde tous les jours.
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const p = req.nextUrl.searchParams;
  const vue = p.get("vue") ?? "actives";
  const q = (p.get("q") ?? "").trim();
  const agenceId = (p.get("agence") ?? "").trim();
  const statut = (p.get("statut") ?? "").trim();

  const contient = { contains: q, mode: "insensitive" as const };
  const where = {
    AND: [
      q
        ? {
            OR: [
              { intitule: contient },
              { city: contient },
              { postalCode: contient },
              { description: contient },
              { contact: { is: { firstName: contient } } },
              { contact: { is: { lastName: contient } } },
              { contact: { is: { phone: contient } } },
              { contact: { is: { email: contient } } },
            ],
          }
        : {},
      agenceId ? { agenceId } : {},
      statut ? { statut } : {},
    ],
  };

  const affaires = await prisma.affaire.findMany({
    where,
    orderBy: [{ prochaineActionAt: "asc" }, { updatedAt: "desc" }],
    take: MAX_RESULTATS,
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      agence: { select: { id: true, nom: true, couleur: true } },
      pro: { select: { id: true, name: true } },
      _count: { select: { bookings: true, documents: true } },
    },
  });

  const visibles = vue === "toutes" ? affaires : affaires.filter((a) => estActive(a.statut));

  // Compteurs par étape, calculés sur toute la base (pas sur la page affichée).
  const parStatut = await prisma.affaire.groupBy({ by: ["statut"], _count: { _all: true } });

  return NextResponse.json({
    affaires: visibles.map(({ _count, ...a }) => ({
      ...a,
      rdvCount: _count.bookings,
      documentsCount: _count.documents,
      groupe: ETAPE_PAR_ID[a.statut]?.groupe ?? "commercial",
    })),
    compteurs: Object.fromEntries(parStatut.map((r) => [r.statut, r._count._all])),
  });
}

/** POST /api/admin/affaires — ouvrir une affaire pour un contact existant. */
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
  const contactId = String(body.contactId ?? "").trim();
  const contact = contactId
    ? await prisma.contact.findUnique({ where: { id: contactId } })
    : null;
  if (!contact) {
    return NextResponse.json({ error: "Choisissez d'abord un client." }, { status: 400 });
  }
  const affaire = await creerAffaire({
    contactId: contact.id,
    projectType: String(body.projectType ?? "autre"),
    description: String(body.description ?? ""),
    address: String(body.address ?? contact.address),
    postalCode: String(body.postalCode ?? contact.postalCode),
    city: String(body.city ?? contact.city),
    statut: String(body.statut ?? "nouvelle"),
  });
  return NextResponse.json({ ok: true, affaire }, { status: 201 });
}
