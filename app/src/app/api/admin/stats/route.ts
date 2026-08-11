import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { estActive, estGagnee, estPerdue } from "@/lib/pipeline";
import { itemsOf, totalHt } from "@/lib/documents";
import { todayParis, addDaysStr, utcToParis } from "@/lib/dates";

export const dynamic = "force-dynamic";

const WEEKS = 12; // profondeur du graphique « rendez-vous par semaine »
const MONTHS = 12; // profondeur du graphique « chiffre d'affaires »

/** Lundi (AAAA-MM-JJ) de la semaine contenant `dateStr`. */
function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return addDaysStr(dateStr, -((dt.getUTCDay() + 6) % 7));
}

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

// GET /api/admin/stats — indicateurs du tableau de bord : volume de RDV,
// taux de transformation des devis et chiffre d'affaires facturé.
export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const today = todayParis();
  const firstMonday = mondayOf(addDaysStr(today, -7 * (WEEKS - 1)));
  const firstMonth = addMonths(today.slice(0, 7), -(MONTHS - 1));

  const [bookings, documents] = await Promise.all([
    prisma.booking.findMany({
      select: { createdAt: true, startAt: true, status: true, kind: true, source: true },
    }),
    prisma.document.findMany({
      select: { type: true, date: true, status: true, itemsJson: true },
    }),
  ]);

  // Un RDV compte dans la semaine où il a lieu ; sans date, dans celle de sa création.
  const dayOf = (b: { createdAt: Date; startAt: Date | null }) =>
    utcToParis(b.startAt ?? b.createdAt).date;

  const weeks: { week: string; devis: number; chantier: number; total: number }[] = [];
  for (let i = 0; i < WEEKS; i++) {
    const week = addDaysStr(firstMonday, i * 7);
    weeks.push({ week, devis: 0, chantier: 0, total: 0 });
  }
  const weekIndex = new Map(weeks.map((w, i) => [w.week, i]));

  const statuses: Record<string, number> = {
    a_faire: 0,
    devis_envoye: 0,
    gagne: 0,
    perdu: 0,
    annule: 0,
  };
  let upcoming = 0;
  const now = new Date();

  for (const b of bookings) {
    if (b.status in statuses) statuses[b.status] += 1;
    if (b.status !== "annule" && b.startAt && b.startAt > now) upcoming += 1;
    const i = weekIndex.get(mondayOf(dayOf(b)));
    if (i === undefined || b.status === "annule") continue;
    weeks[i].total += 1;
    if (b.kind === "chantier") weeks[i].chantier += 1;
    else weeks[i].devis += 1;
  }

  // Taux de transformation : gagnés / (gagnés + perdus), les RDV encore ouverts
  // ne comptent pas — sinon le taux baisserait à chaque nouvelle réservation.
  const decided = statuses.gagne + statuses.perdu;
  const winRate = decided ? Math.round((statuses.gagne / decided) * 100) : null;

  // Chiffre d'affaires : montants HT des factures, par mois d'émission.
  const months: { month: string; facture: number; encaisse: number }[] = [];
  for (let i = 0; i < MONTHS; i++) months.push({ month: addMonths(firstMonth, i), facture: 0, encaisse: 0 });
  const monthIndex = new Map(months.map((m, i) => [m.month, i]));

  let devisEnvoyes = 0;
  let devisAcceptes = 0;
  let resteAEncaisser = 0;

  for (const doc of documents) {
    const ht = totalHt(itemsOf(doc.itemsJson));
    if (doc.type === "devis") {
      if (doc.status !== "brouillon") devisEnvoyes += 1;
      if (doc.status === "accepte") devisAcceptes += 1;
      continue;
    }
    if (doc.status !== "payee") resteAEncaisser += ht;
    const i = monthIndex.get(doc.date.slice(0, 7));
    if (i === undefined) continue;
    months[i].facture += ht;
    if (doc.status === "payee") months[i].encaisse += ht;
  }

  const thisMonth = today.slice(0, 7);
  const caMois = months.find((m) => m.month === thisMonth)?.facture ?? 0;
  const caAnnee = months
    .filter((m) => m.month.startsWith(today.slice(0, 4)))
    .reduce((acc, m) => acc + m.facture, 0);

  // Entonnoir CRM : combien de demandes reçues, combien de projets réellement
  // engagés, et quel taux de transformation sur les seules affaires décidées.
  const contactsTotal = await prisma.contact.count();
  const affaires = await prisma.affaire.findMany({ select: { statut: true, montant: true } });
  const affairesGagnees = affaires.filter((a) => estGagnee(a.statut)).length;
  const affairesPerdues = affaires.filter((a) => estPerdue(a.statut)).length;
  const affairesActives = affaires.filter((a) => estActive(a.statut)).length;
  const affairesDecidees = affairesGagnees + affairesPerdues;
  const tauxAffaires = affairesDecidees
    ? Math.round((affairesGagnees / affairesDecidees) * 100)
    : null;
  // Valeur du pipeline : ce qui est encore en jeu.
  const pipelineMontant = affaires
    .filter((a) => estActive(a.statut))
    .reduce((acc, a) => acc + (a.montant ?? 0), 0);

  return NextResponse.json({
    weeks,
    months,
    statuses,
    crm: {
      contacts: contactsTotal,
      affaires: affaires.length,
      actives: affairesActives,
      gagnees: affairesGagnees,
      perdues: affairesPerdues,
      taux: tauxAffaires,
      pipelineMontant,
    },
    totals: {
      bookings: bookings.length,
      upcoming,
      winRate,
      decided,
      devisEnvoyes,
      devisAcceptes,
      caMois,
      caAnnee,
      resteAEncaisser,
    },
  });
}
