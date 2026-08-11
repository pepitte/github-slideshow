import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { creerAffaire, intituleAuto } from "@/lib/affaires";
import { REPRISE_STATUTS } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/affaires/reprise — crée les affaires à partir des rendez-vous
 * existants. Un rendez-vous « à faire / devis envoyé / gagné / perdu / annulé »
 * devient une affaire à l'étape correspondante.
 *
 * Règle de regroupement : les rendez-vous d'un même client qui se suivent dans
 * le même dossier (une visite devis puis son chantier) rejoignent la MÊME
 * affaire ; un rendez-vous éloigné dans le temps en ouvre une nouvelle.
 *
 * Idempotent : les rendez-vous déjà rattachés sont ignorés.
 */
export async function POST() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const bookings = await prisma.booking.findMany({
    where: { affaireId: null, contactId: { not: null } },
    orderBy: { createdAt: "asc" },
  });

  // Deux rendez-vous du même client à plus de 90 jours d'écart sont deux
  // projets différents (une taille de haie au printemps, une autre à l'automne).
  const ECART_MAX = 90 * 24 * 3600_000;
  const derniere = new Map<string, { id: string; quand: number }>();
  let creees = 0;
  let rattaches = 0;

  for (const b of bookings) {
    const quand = (b.startAt ?? b.createdAt).getTime();
    const precedente = derniere.get(b.contactId!);
    let affaireId: string;

    if (precedente && Math.abs(quand - precedente.quand) <= ECART_MAX) {
      affaireId = precedente.id;
    } else {
      const affaire = await creerAffaire({
        contactId: b.contactId!,
        projectType: b.projectType,
        description: b.description,
        address: b.address,
        postalCode: b.postalCode,
        city: b.city,
        statut: REPRISE_STATUTS[b.status] ?? "nouvelle",
        proId: b.proId,
      });
      affaireId = affaire.id;
      creees++;
    }

    await prisma.booking.update({ where: { id: b.id }, data: { affaireId } });
    derniere.set(b.contactId!, { id: affaireId, quand });
    rattaches++;
  }

  // Les affaires reprennent l'intitulé du projet et le montant du devis chiffré
  // quand il en existe un pour ce client.
  const sansMontant = await prisma.affaire.findMany({
    where: { montant: null },
    include: { contact: { select: { email: true, phone: true } } },
  });
  let montants = 0;
  for (const a of sansMontant) {
    if (!a.contact.email && !a.contact.phone) continue;
    const doc = await prisma.document.findFirst({
      where: {
        type: "devis",
        OR: [
          ...(a.contact.email ? [{ clientEmail: a.contact.email }] : []),
          ...(a.contact.phone ? [{ clientPhone: a.contact.phone }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    if (!doc) continue;
    let total = 0;
    try {
      for (const l of JSON.parse(doc.itemsJson) as { qty: number; unitPrice: number }[]) {
        total += (Number(l.qty) || 0) * (Number(l.unitPrice) || 0);
      }
    } catch {}
    await prisma.affaire.update({
      where: { id: a.id },
      data: {
        montant: total || null,
        intitule: a.intitule || intituleAuto(a.projectType, a.city),
      },
    });
    await prisma.document.update({ where: { id: doc.id }, data: { affaireId: a.id } });
    montants++;
  }

  const total = await prisma.affaire.count();
  return NextResponse.json({
    ok: true,
    creees,
    rattaches,
    montants,
    total,
    message:
      `${creees} affaire(s) créée(s) à partir de ${rattaches} rendez-vous, ` +
      `${montants} devis chiffré(s) rattaché(s). Total : ${total} affaire(s).`,
  });
}
