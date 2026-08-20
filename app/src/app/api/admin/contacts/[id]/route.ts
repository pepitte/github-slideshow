import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { journaliser, phoneKeyOf } from "@/lib/contacts";
import { affaireOuverteDe, changerStatut, creerAffaire } from "@/lib/affaires";
import { ETAPE_PAR_ID } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

/** GET /api/admin/contacts/:id — fiche complète : coordonnées, RDV, échanges. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
    include: {
      agence: { select: { id: true, nom: true, couleur: true } },
      interactions: { orderBy: { createdAt: "desc" }, take: 100 },
      bookings: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          kind: true,
          status: true,
          startAt: true,
          endAt: true,
          city: true,
          projectType: true,
          source: true,
        },
      },
    },
  });
  if (!contact) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  return NextResponse.json({ contact });
}

/** PATCH /api/admin/contacts/:id — coordonnées, secteur, notes. */
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
  const existe = await prisma.contact.findUnique({ where: { id: params.id } });
  if (!existe) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const data: Record<string, unknown> = {};
  const champs = ["firstName", "lastName", "email", "address", "postalCode", "city", "notes", "origine"];
  for (const c of champs) {
    if (typeof body[c] === "string") data[c] = String(body[c]).trim().slice(0, 2000);
  }
  if (typeof body.phone === "string") {
    data.phone = body.phone.trim();
    data.phoneKey = phoneKeyOf(body.phone);
  }
  // Suivi rapide depuis le tableau de bord. Chaque geste laisse une trace dans
  // le journal du contact : sa fiche doit raconter ce qui s'est passé.
  let journal = "";
  if (body.contacte !== undefined) {
    data.contacteAt = body.contacte ? new Date() : null;
    if (body.contacte) {
      data.relanceAt = null;
      journal = "Marqué « déjà contacté » depuis le tableau de bord.";
    }
  }
  if (body.relance !== undefined) {
    data.relanceAt = body.relance ? new Date() : null;
    if (body.relance) journal = "Marqué « à recontacter » depuis le tableau de bord.";
  }
  if (body.agenceId !== undefined) {
    const brut = String(body.agenceId ?? "").trim();
    data.agenceId = brut && (await prisma.agence.findUnique({ where: { id: brut } })) ? brut : null;
  }

  // Suivi commercial posé depuis la liste des clients. La vérité reste dans
  // l'affaire : un contact sans affaire en obtient une, plutôt qu'un second
  // état parallèle qui finirait par contredire la page Affaires.
  if (typeof body.statut === "string" && ETAPE_PAR_ID[body.statut]) {
    const existante =
      (await affaireOuverteDe(params.id, "chantier")) ??
      (await prisma.affaire.findFirst({
        where: { contactId: params.id },
        orderBy: { updatedAt: "desc" },
      }));
    if (existante) {
      await changerStatut(existante.id, body.statut);
    } else {
      await creerAffaire({
        contactId: params.id,
        address: existe.address,
        postalCode: existe.postalCode,
        city: existe.city,
        statut: body.statut,
      });
    }
  }

  const contact = await prisma.contact.update({ where: { id: params.id }, data });
  if (journal) {
    await journaliser(contact.id, "appel", journal, { sens: "sortant", auteur: "gerant" });
  }
  return NextResponse.json({ ok: true, contact });
}

/** POST /api/admin/contacts/:id — ajouter une ligne au journal des échanges. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const contenu = String(body.contenu ?? "").trim();
  if (!contenu) return NextResponse.json({ error: "Le contenu est vide." }, { status: 400 });
  const existe = await prisma.contact.findUnique({ where: { id: params.id } });
  if (!existe) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const type = ["appel", "email", "sms", "note"].includes(String(body.type))
    ? String(body.type)
    : "note";
  const sens = ["entrant", "sortant", "interne"].includes(String(body.sens))
    ? String(body.sens)
    : "interne";
  await journaliser(params.id, type, contenu, { sens, auteur: "gerant" });
  const interactions = await prisma.interaction.findMany({
    where: { contactId: params.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ ok: true, interactions });
}

/** DELETE /api/admin/contacts/:id — supprimer une fiche (RGPD). */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    await prisma.contact.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }
}
