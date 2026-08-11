import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { creerOuCompleterContact, journaliser, splitNom } from "@/lib/contacts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/contacts/reprise — remplit la base « Tous les clients » à
 * partir de l'existant : rendez-vous, prospects et comptes particuliers.
 *
 * Idempotent : relancer l'opération ne crée aucun doublon (le rapprochement se
 * fait sur le téléphone normalisé puis sur l'email) et ne réécrit pas les
 * rendez-vous déjà rattachés.
 */
export async function POST() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let contactsAvant = await prisma.contact.count();
  let rdvRattaches = 0;
  let prospects = 0;
  let comptes = 0;

  // 1. Les rendez-vous, du plus ancien au plus récent : le premier passage
  //    crée la fiche, les suivants la complètent.
  const bookings = await prisma.booking.findMany({
    where: { contactId: null },
    orderBy: { createdAt: "asc" },
  });
  for (const b of bookings) {
    if (!b.phone && !b.email && !b.lastName && !b.firstName) continue;
    const contact = await creerOuCompleterContact({
      firstName: b.firstName,
      lastName: b.lastName,
      phone: b.phone,
      email: b.email,
      address: b.address,
      postalCode: b.postalCode,
      city: b.city,
      origine: b.source === "manual" ? "phone" : "web",
    });
    await prisma.booking.update({ where: { id: b.id }, data: { contactId: contact.id } });
    rdvRattaches++;
  }

  // 2. Les prospects (formulaire hors zone et publicités Meta).
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "asc" } });
  for (const l of leads) {
    if (!l.phone && !l.email) continue;
    const contact = await creerOuCompleterContact({
      ...splitNom(l.name),
      phone: l.phone,
      email: l.email,
      postalCode: l.postalCode,
      origine: l.source === "meta" ? "meta" : "site",
    });
    // Une seule note de reprise par contact, même si l'opération est relancée.
    const dejaNote = await prisma.interaction.findFirst({
      where: { contactId: contact.id, type: "note", contenu: { startsWith: "[Reprise]" } },
    });
    if (!dejaNote) {
      await journaliser(
        contact.id,
        "note",
        `[Reprise] ${l.message || "Prospect enregistré avant la mise en place de la base clients."}`,
        { sens: "entrant" }
      );
    }
    prospects++;
  }

  // 3. Les comptes particuliers créés sur le site.
  const clients = await prisma.client.findMany();
  for (const c of clients) {
    await creerOuCompleterContact({
      ...splitNom(c.name),
      phone: c.phone,
      email: c.email,
      address: c.address,
      postalCode: c.postalCode,
      city: c.city,
      origine: "web",
    });
    comptes++;
  }

  const contactsApres = await prisma.contact.count();
  return NextResponse.json({
    ok: true,
    crees: contactsApres - contactsAvant,
    total: contactsApres,
    rdvRattaches,
    prospects,
    comptes,
    message:
      `${contactsApres - contactsAvant} fiche(s) créée(s), ${rdvRattaches} rendez-vous rattaché(s), ` +
      `${prospects} prospect(s) et ${comptes} compte(s) repris. Base : ${contactsApres} client(s).`,
  });
}
