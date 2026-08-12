// Cloche de notifications du gérant.
//
// Rien n'est stocké : la liste est reconstruite à chaque ouverture à partir de
// ce qui existe déjà (rendez-vous, prospects, rapports de chantier, affaires).
// Un journal de notifications aurait imposé d'écrire à chaque événement — et
// n'aurait rien montré de ce qui s'est passé avant sa mise en place.
//
// « Lu » = daté d'avant `Settings.notificationsSeenAt`.
import { prisma } from "@/lib/prisma";
import { estActive } from "@/lib/pipeline";

export type Notification = {
  id: string;
  /** Détermine l'icône et la couleur côté écran. */
  type: "rdv" | "lead" | "attribuer" | "rapport" | "relance" | "annule";
  titre: string;
  texte: string;
  date: string;
  lien: string;
  lue: boolean;
};

const MAX = 25;
const FENETRE_JOURS = 21;

function nomDe(b: { firstName: string; lastName: string }): string {
  return `${b.firstName} ${b.lastName}`.trim() || "Client sans nom";
}

function jourFr(d: Date | null): string {
  if (!d) return "date à définir";
  return d.toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "long",
  });
}

export async function listerNotifications(): Promise<{
  notifications: Notification[];
  nonLues: number;
}> {
  const settings = await prisma.settings.findFirst();
  const vuA = settings?.notificationsSeenAt ?? null;
  const depuis = new Date(Date.now() - FENETRE_JOURS * 86400000);
  const maintenant = new Date();
  const items: Omit<Notification, "lue">[] = [];

  // 1. Chantiers à venir sans paysagiste attribué : le plus urgent de la liste.
  const aAttribuer = await prisma.booking.findMany({
    where: {
      kind: "chantier", proId: null, status: { not: "annule" },
      startAt: { gte: maintenant },
    },
    orderBy: { startAt: "asc" },
    take: MAX,
    select: { id: true, createdAt: true, firstName: true, lastName: true, city: true, startAt: true },
  });
  for (const b of aAttribuer) {
    items.push({
      id: `attribuer-${b.id}`,
      type: "attribuer",
      titre: "Chantier à attribuer",
      texte: `${nomDe(b)}${b.city ? ` — ${b.city}` : ""}, le ${jourFr(b.startAt)} : aucun paysagiste disponible`,
      date: b.createdAt.toISOString(),
      lien: "/admin/rendez-vous",
    });
  }
  const dejaSignales = new Set(aAttribuer.map((b) => b.id));

  // 2. Réservations reçues sur le site. Un chantier déjà signalé « à attribuer »
  // n'est pas annoncé deux fois : la ligne d'alerte dit déjà qu'il est arrivé.
  const nouveaux = await prisma.booking.findMany({
    where: { source: "web", createdAt: { gte: depuis }, status: { not: "annule" } },
    orderBy: { createdAt: "desc" },
    take: MAX,
    select: {
      id: true, createdAt: true, kind: true, firstName: true, lastName: true,
      city: true, startAt: true,
    },
  });
  for (const b of nouveaux) {
    if (dejaSignales.has(b.id)) continue;
    items.push({
      id: `rdv-${b.id}`,
      type: "rdv",
      titre: b.kind === "chantier" ? "Nouveau chantier réservé" : "Nouvelle visite de devis",
      texte: `${nomDe(b)}${b.city ? ` — ${b.city}` : ""}, le ${jourFr(b.startAt)}`,
      date: b.createdAt.toISOString(),
      lien: "/admin/rendez-vous",
    });
  }

  // 3. Prospects (formulaire hors zone, publicités Meta).
  const leads = await prisma.lead.findMany({
    where: { createdAt: { gte: depuis } },
    orderBy: { createdAt: "desc" },
    take: MAX,
    select: { id: true, createdAt: true, name: true, postalCode: true, source: true },
  });
  for (const l of leads) {
    items.push({
      id: `lead-${l.id}`,
      type: "lead",
      titre: l.source === "meta" ? "Nouveau prospect (publicité)" : "Nouveau prospect",
      texte: `${l.name || "Sans nom"}${l.postalCode ? ` — ${l.postalCode}` : ""}`,
      date: l.createdAt.toISOString(),
      lien: "/admin/clients",
    });
  }

  // 4. Rapports de chantier remplis par les paysagistes, pas encore validés.
  const rapports = await prisma.workEntry.findMany({
    where: {
      validated: false,
      updatedAt: { gte: depuis },
      NOT: [{ photosBeforeJson: "[]" }, { photosAfterJson: "[]" }],
    },
    orderBy: { updatedAt: "desc" },
    take: MAX,
    select: { id: true, updatedAt: true, date: true, pro: { select: { name: true } } },
  });
  for (const r of rapports) {
    items.push({
      id: `rapport-${r.id}`,
      type: "rapport",
      titre: "Rapport de chantier à valider",
      texte: `${r.pro?.name ?? "Un paysagiste"} a ajouté des photos pour le ${jourFr(
        new Date(`${r.date}T12:00:00Z`)
      )}`,
      date: r.updatedAt.toISOString(),
      lien: "/admin/chantiers",
    });
  }

  // 5. Affaires dont la prochaine action est arrivée à échéance.
  const relances = await prisma.affaire.findMany({
    where: { prochaineActionAt: { lte: maintenant } },
    orderBy: { prochaineActionAt: "asc" },
    take: MAX,
    select: {
      id: true, intitule: true, statut: true, prochaineActionAt: true,
      contact: { select: { firstName: true, lastName: true } },
    },
  });
  for (const a of relances) {
    if (!estActive(a.statut) || !a.prochaineActionAt) continue;
    items.push({
      id: `relance-${a.id}`,
      type: "relance",
      titre: "Relance à faire",
      texte: `${nomDe(a.contact)} — ${a.intitule || "affaire en cours"}, prévue le ${jourFr(
        a.prochaineActionAt
      )}`,
      date: a.prochaineActionAt.toISOString(),
      lien: "/admin/affaires",
    });
  }

  // 6. Annulations : un créneau se libère, et parfois un client à rappeler.
  const annules = await prisma.booking.findMany({
    where: { status: "annule", cancelledAt: { gte: depuis } },
    orderBy: { cancelledAt: "desc" },
    take: MAX,
    select: {
      id: true, cancelledAt: true, kind: true, firstName: true, lastName: true, startAt: true,
    },
  });
  for (const b of annules) {
    if (!b.cancelledAt) continue;
    items.push({
      id: `annule-${b.id}`,
      type: "annule",
      titre: b.kind === "chantier" ? "Chantier annulé" : "Visite annulée",
      texte: `${nomDe(b)} — créneau du ${jourFr(b.startAt)} libéré`,
      date: b.cancelledAt.toISOString(),
      lien: "/admin/rendez-vous",
    });
  }

  const notifications = items
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX)
    .map((n) => ({ ...n, lue: vuA != null && new Date(n.date) <= vuA }));

  return { notifications, nonLues: notifications.filter((n) => !n.lue).length };
}

/** « Tout marquer comme lu ». */
export async function marquerToutLu(): Promise<void> {
  const settings = await prisma.settings.findFirst();
  if (!settings) return;
  await prisma.settings.update({
    where: { id: settings.id },
    data: { notificationsSeenAt: new Date() },
  });
}
