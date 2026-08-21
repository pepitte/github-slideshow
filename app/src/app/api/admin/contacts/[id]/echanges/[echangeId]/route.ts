import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TYPES = ["appel", "email", "sms", "note", "rdv", "devis"];

/** Le journal du contact, tel que la fiche l'affiche. */
async function journal(contactId: string) {
  return prisma.interaction.findMany({
    where: { contactId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

/**
 * PATCH /api/admin/contacts/:id/echanges/:echangeId — corriger une ligne du
 * journal. Une note prise à la volée pendant un appel contient souvent une
 * faute ou une information incomplète ; jusqu'ici elle était figée.
 *
 * La date et l'auteur ne bougent pas : c'est l'historique, pas un brouillon.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; echangeId: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  // L'échange doit bien appartenir à ce contact : sans cette vérification, un
  // identifiant d'échange suffirait à modifier la fiche de n'importe qui.
  const echange = await prisma.interaction.findUnique({ where: { id: params.echangeId } });
  if (!echange || echange.contactId !== params.id) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.contenu === "string") {
    const contenu = body.contenu.trim();
    if (!contenu) return NextResponse.json({ error: "Le contenu est vide." }, { status: 400 });
    data.contenu = contenu.slice(0, 2000);
  }
  if (typeof body.type === "string" && TYPES.includes(body.type)) {
    data.type = body.type;
  }
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Rien à modifier." }, { status: 400 });
  }

  await prisma.interaction.update({ where: { id: params.echangeId }, data });
  return NextResponse.json({ ok: true, interactions: await journal(params.id) });
}
