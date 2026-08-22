import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { creerOuCompleterContact, journaliser, phoneKeyOf } from "@/lib/contacts";
import { estGagnee, estPerdue } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

const MAX_RESULTATS = 200;

/**
 * GET /api/admin/contacts?q=&origine=&agence=&statut=&cp= — la base
 * « Tous les clients ».
 * Recherche serveur sur nom, téléphone, email, ville et code postal.
 *
 * Chaque ligne est enrichie de ce que le gérant veut voir d'un coup d'œil :
 * type de contrat, chiffre d'affaires généré, date du dernier échange, et si
 * le client est perdu. Les totaux portent sur TOUT le résultat filtré, pas
 * seulement sur la page affichée.
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const p = req.nextUrl.searchParams;
  const q = (p.get("q") ?? "").trim();
  const origine = (p.get("origine") ?? "").trim();
  const agenceId = (p.get("agence") ?? "").trim();
  // Onglets du tableau : une étape du pipeline, ou un secteur par préfixe de
  // code postal. Le préfixe plutôt que l'agence, parce qu'un secteur se lit
  // dans le code postal du client même quand aucune agence n'est configurée.
  const statut = (p.get("statut") ?? "").trim();
  const cp = (p.get("cp") ?? "").trim();

  const contient = { contains: q, mode: "insensitive" as const };
  const where = {
    AND: [
      q
        ? {
            OR: [
              { firstName: contient },
              { lastName: contient },
              { phone: contient },
              { phoneKey: { contains: phoneKeyOf(q) || " " } },
              { email: contient },
              { city: contient },
              { postalCode: contient },
              { notes: contient },
            ],
          }
        : {},
      origine ? { origine } : {},
      agenceId ? { agenceId } : {},
      statut ? { affaires: { some: { statut } } } : {},
      cp ? { postalCode: { startsWith: cp } } : {},
    ],
  };

  // Tous les identifiants concernés : sert à calculer les totaux sur l'ensemble
  // du filtre, pas seulement sur les 200 lignes renvoyées.
  const tous = await prisma.contact.findMany({ where, select: { id: true } });
  const ids = tous.map((c) => c.id);

  const [affaires, rdv, derniers] = await Promise.all([
    ids.length
      ? prisma.affaire.findMany({
          where: { contactId: { in: ids } },
          select: { id: true, contactId: true, statut: true, montant: true, projectType: true, updatedAt: true },
        })
      : [],
    ids.length
      ? prisma.booking.findMany({
          where: { contactId: { in: ids } },
          select: { contactId: true, projectType: true },
        })
      : [],
    ids.length
      ? prisma.interaction.groupBy({
          by: ["contactId"],
          where: { contactId: { in: ids } },
          _max: { createdAt: true },
        })
      : [],
  ]);

  type Resume = { ca: number; contrat: boolean; affaires: number; perdu: boolean };
  const resumes = new Map<string, Resume>();
  const de = (id: string): Resume => {
    if (!resumes.has(id)) resumes.set(id, { ca: 0, contrat: false, affaires: 0, perdu: false });
    return resumes.get(id)!;
  };

  // Un client est « perdu » quand TOUTES ses affaires le sont : une seule
  // affaire encore vivante suffit à le garder actif.
  const perdues = new Map<string, { total: number; perdues: number }>();
  for (const a of affaires) {
    const r = de(a.contactId!);
    r.affaires += 1;
    if (estGagnee(a.statut)) r.ca += a.montant ?? 0;
    if (a.projectType === "contrat_annuel") r.contrat = true;
    const c = perdues.get(a.contactId!) ?? { total: 0, perdues: 0 };
    c.total += 1;
    if (estPerdue(a.statut)) c.perdues += 1;
    perdues.set(a.contactId!, c);
  }
  for (const [id, c] of Array.from(perdues.entries())) {
    if (c.total > 0 && c.total === c.perdues) de(id).perdu = true;
  }
  // Un contrat annuel réservé avant la mise en place des affaires compte aussi.
  for (const b of rdv) {
    if (b.contactId && b.projectType === "contrat_annuel") de(b.contactId).contrat = true;
  }
  // L'affaire à montrer dans la liste : la plus récemment bougée. Un contact
  // peut en porter plusieurs, mais la colonne n'a la place que d'une seule —
  // la page Affaires reste l'endroit pour les voir toutes.
  const courante = new Map<string, { id: string; statut: string; quand: number }>();
  for (const a of affaires) {
    if (!a.contactId) continue;
    const quand = a.updatedAt.getTime();
    const actuelle = courante.get(a.contactId);
    if (!actuelle || quand > actuelle.quand) {
      courante.set(a.contactId, { id: a.id, statut: a.statut, quand });
    }
  }

  const dernierEchange = new Map<string, string>();
  for (const d of derniers) {
    if (d._max.createdAt) dernierEchange.set(d.contactId, d._max.createdAt.toISOString());
  }

  const contacts = await prisma.contact.findMany({
    where,
    // Ordre alphabétique : on cherche un client par son nom, pas par sa date
    // d'arrivée (le filtre « origine » sert à repérer les nouveaux).
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: MAX_RESULTATS,
    include: {
      agence: { select: { id: true, nom: true, couleur: true } },
      _count: { select: { bookings: true, interactions: true } },
    },
  });

  const total = ids.length;
  const nbPerdus = Array.from(resumes.values()).filter((r) => r.perdu).length;
  const caTotal = Array.from(resumes.values()).reduce((acc, r) => acc + r.ca, 0);

  return NextResponse.json({
    contacts: contacts.map(({ _count, ...c }) => {
      const r = resumes.get(c.id);
      return {
        ...c,
        rdvCount: _count.bookings,
        echangesCount: _count.interactions,
        caGenere: r?.ca ?? 0,
        contrat: r?.contrat ? "annuel" : "ponctuel",
        affairesCount: r?.affaires ?? 0,
        perdu: r?.perdu ?? false,
        affaireId: courante.get(c.id)?.id ?? null,
        affaireStatut: courante.get(c.id)?.statut ?? "",
        dernierEchange: dernierEchange.get(c.id) ?? null,
      };
    }),
    total,
    stats: { total, actifs: total - nbPerdus, perdus: nbPerdus, caTotal },
    tronque: total > contacts.length,
  });
}

/** POST /api/admin/contacts — ajouter un client à la main (appel reçu). */
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
  const s = (k: string) => String(body[k] ?? "").trim();
  if (!s("firstName") && !s("lastName") && !s("phone") && !s("email")) {
    return NextResponse.json(
      { error: "Renseignez au moins un nom, un téléphone ou un email." },
      { status: 400 }
    );
  }
  const contact = await creerOuCompleterContact({
    firstName: s("firstName"),
    lastName: s("lastName"),
    phone: s("phone"),
    email: s("email"),
    address: s("address"),
    postalCode: s("postalCode"),
    city: s("city"),
    origine: s("origine") || "phone",
  });
  const note = s("note");
  if (note) await journaliser(contact.id, "appel", note, { sens: "entrant", auteur: "gerant" });
  return NextResponse.json({ ok: true, contact }, { status: 201 });
}
