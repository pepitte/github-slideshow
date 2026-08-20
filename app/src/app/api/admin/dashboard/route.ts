import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { itemsOf, totalHt } from "@/lib/documents";
import { todayParis, addDaysStr, parisTimeToUtc, utcToParis } from "@/lib/dates";

export const dynamic = "force-dynamic";

const MOIS_GRAPHIQUE = 6;

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * GET /api/admin/dashboard — la vue d'ensemble : trois chiffres du moment,
 * l'évolution du chiffre d'affaires, les demandes que personne n'a encore
 * traitées et les prochains rendez-vous.
 */
export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const today = todayParis();
  const moisCourant = today.slice(0, 7);
  const moisPrecedent = addMonths(moisCourant, -1);
  const debutGraphique = addMonths(moisCourant, -(MOIS_GRAPHIQUE - 1));
  const debutMois = parisTimeToUtc(`${moisCourant}-01`, "00:00");
  const debutMoisPrec = parisTimeToUtc(`${moisPrecedent}-01`, "00:00");
  // Semaine en cours, du lundi au dimanche.
  const lundi = addDaysStr(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const dimancheSoir = parisTimeToUtc(addDaysStr(lundi, 7), "00:00");

  const [nouveauxCeMois, nouveauxMoisPrec, chantiersSemaine, documents, aTraiterBruts, prochains] =
    await Promise.all([
      prisma.contact.count({ where: { createdAt: { gte: debutMois } } }),
      prisma.contact.count({ where: { createdAt: { gte: debutMoisPrec, lt: debutMois } } }),
      prisma.booking.count({
        where: {
          kind: "chantier",
          status: { not: "annule" },
          startAt: { gte: parisTimeToUtc(lundi, "00:00"), lt: dimancheSoir },
        },
      }),
      prisma.document.findMany({ select: { type: true, date: true, status: true, itemsJson: true } }),
      // Demandes que personne n'a encore prises en main : ni affaire, ni
      // rendez-vous, ni marquées « déjà contacté ». C'est la liste qui garantit
      // qu'aucun prospect ne se perd.
      //
      // Le filtre « arrivé il y a plus de 24 h » a été retiré : à l'import des
      // prospects Meta, 101 fiches créées le jour même restaient invisibles ici
      // — exactement celles qu'il fallait rappeler. C'est le gérant qui décide
      // quand un lead sort de la liste, pas l'horloge.
      prisma.contact.findMany({
        where: {
          contacteAt: null,
          affaires: { none: {} },
          bookings: { none: {} },
        },
        orderBy: { createdAt: "asc" },
        take: 12,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          origine: true,
          city: true,
          createdAt: true,
          notes: true,
          // Le premier message reçu dit ce que le prospect demande : c'est
          // cette phrase que le gérant lit pour décider quoi faire.
          interactions: {
            where: { sens: "entrant" },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { contenu: true },
          },
        },
      }),
      prisma.booking.findMany({
        where: { status: { not: "annule" }, startAt: { gte: new Date() } },
        orderBy: { startAt: "asc" },
        take: 6,
        select: {
          id: true,
          kind: true,
          firstName: true,
          lastName: true,
          city: true,
          startAt: true,
          endAt: true,
          pro: { select: { id: true, name: true } },
        },
      }),
    ]);

  // Chiffre d'affaires facturé, par mois d'émission.
  const mois: { mois: string; ca: number }[] = [];
  for (let i = 0; i < MOIS_GRAPHIQUE; i++) mois.push({ mois: addMonths(debutGraphique, i), ca: 0 });
  const index = new Map(mois.map((m, i) => [m.mois, i]));
  for (const doc of documents) {
    if (doc.type !== "facture") continue;
    const i = index.get((doc.date ?? "").slice(0, 7));
    if (i === undefined) continue;
    mois[i].ca += totalHt(itemsOf(doc.itemsJson));
  }
  const caMois = mois[mois.length - 1]?.ca ?? 0;

  const evolution =
    nouveauxMoisPrec > 0
      ? Math.round(((nouveauxCeMois - nouveauxMoisPrec) / nouveauxMoisPrec) * 100)
      : null;

  const aTraiterTotal = await prisma.contact.count({
    where: { contacteAt: null, affaires: { none: {} }, bookings: { none: {} } },
  });

  const aTraiter = aTraiterBruts.map(({ interactions, notes, ...c }) => ({
    ...c,
    // Une seule ligne : le journal complet est sur la fiche du client.
    demande:
      (interactions[0]?.contenu ?? notes ?? "").split("\n")[0].trim() || c.city || "",
    jours: Math.max(
      0,
      Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000)
    ),
  }));

  return NextResponse.json({
    tuiles: {
      nouveauxCeMois,
      nouveauxMoisPrec,
      evolution,
      caMois,
      chantiersSemaine,
    },
    mois,
    aTraiter,
    aTraiterTotal,
    prochains: prochains.map((b) => ({
      ...b,
      jour: b.startAt ? utcToParis(b.startAt).date : "",
    })),
  });
}
