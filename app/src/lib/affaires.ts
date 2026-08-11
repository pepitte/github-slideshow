// Création et progression des affaires. Une affaire naît dès qu'un PROJET est
// identifié (un besoin + une adresse) : un simple renseignement tarifaire reste
// un contact sans affaire, sinon le pipeline se remplit de bruit.
import type { Affaire, Booking } from "@prisma/client";
import { prisma } from "./prisma";
import { agencePour } from "./agences";
import { journaliser } from "./contacts";
import { ETAPE_PAR_ID } from "./pipeline";

const LIBELLES_PROJET: Record<string, string> = {
  entretien: "Entretien de jardin",
  taille_haie: "Taille de haie",
  debroussaillage: "Débroussaillage",
  contrat_annuel: "Contrat d'entretien",
  autre: "Projet",
};

export function intituleAuto(projectType: string, city: string): string {
  const base = LIBELLES_PROJET[projectType] ?? "Projet";
  return city ? `${base} — ${city}` : base;
}

/**
 * L'affaire d'un contact que ce nouveau rendez-vous doit rejoindre, s'il y en
 * a une. On ne rouvre jamais une affaire close : une nouvelle demande d'un
 * ancien client est une NOUVELLE affaire — c'est tout l'intérêt d'avoir séparé
 * le contact du projet.
 *
 * La règle dépend du type de rendez-vous :
 * - une VISITE DEVIS ne rejoint qu'une affaire encore au stade commercial ;
 *   demander un devis alors qu'un chantier est déjà lancé, c'est un autre projet ;
 * - un CHANTIER rejoint aussi une affaire en cours d'exécution, puisqu'il en
 *   est la suite naturelle (le devis vient d'être accepté).
 */
export async function affaireOuverteDe(
  contactId: string,
  kind: string = "devis"
): Promise<Affaire | null> {
  const affaires = await prisma.affaire.findMany({
    where: { contactId },
    orderBy: { updatedAt: "desc" },
  });
  const groupesAcceptes =
    kind === "chantier" ? ["commercial", "execution"] : ["commercial"];
  return (
    affaires.find((a) => groupesAcceptes.includes(ETAPE_PAR_ID[a.statut]?.groupe ?? "")) ?? null
  );
}

export type NouvelleAffaire = {
  contactId: string;
  projectType?: string;
  description?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  statut?: string;
  proId?: string | null;
};

/** Crée l'affaire et la rattache au secteur déduit du code postal. */
export async function creerAffaire(entree: NouvelleAffaire): Promise<Affaire> {
  const cp = (entree.postalCode ?? "").trim();
  const agence = cp ? await agencePour(cp) : null;
  const affaire = await prisma.affaire.create({
    data: {
      contactId: entree.contactId,
      intitule: intituleAuto(entree.projectType ?? "autre", entree.city ?? ""),
      projectType: entree.projectType ?? "autre",
      description: entree.description ?? "",
      address: entree.address ?? "",
      postalCode: cp,
      city: entree.city ?? "",
      statut: entree.statut ?? "nouvelle",
      agenceId: agence?.agence.id ?? null,
      proId: entree.proId ?? null,
    },
  });
  return affaire;
}

/**
 * Rattache un rendez-vous à une affaire : celle déjà ouverte pour ce contact,
 * sinon une nouvelle. Fait avancer l'étape selon le type de rendez-vous.
 */
export async function affairePourRdv(
  booking: Pick<Booking, "id" | "contactId" | "kind" | "projectType" | "description" | "address" | "postalCode" | "city" | "proId">
): Promise<Affaire | null> {
  if (!booking.contactId) return null;
  const statutVise = booking.kind === "chantier" ? "chantier_planifie" : "visite_planifiee";

  let affaire = await affaireOuverteDe(booking.contactId, booking.kind);
  if (!affaire) {
    affaire = await creerAffaire({
      contactId: booking.contactId,
      projectType: booking.projectType,
      description: booking.description,
      address: booking.address,
      postalCode: booking.postalCode,
      city: booking.city,
      statut: statutVise,
      proId: booking.proId,
    });
  } else {
    // On n'écrase une étape que si le rendez-vous fait avancer le dossier.
    const ordreActuel = ETAPE_PAR_ID[affaire.statut]?.ordre ?? 0;
    const ordreVise = ETAPE_PAR_ID[statutVise]?.ordre ?? 0;
    const data: Record<string, unknown> = {};
    if (ordreVise > ordreActuel) data.statut = statutVise;
    if (booking.proId && !affaire.proId) data.proId = booking.proId;
    if (Object.keys(data).length) {
      affaire = await prisma.affaire.update({ where: { id: affaire.id }, data });
    }
  }
  await prisma.booking.update({ where: { id: booking.id }, data: { affaireId: affaire.id } });
  return affaire;
}

/** Change l'étape d'une affaire et journalise le mouvement chez le contact. */
export async function changerStatut(
  affaireId: string,
  statut: string,
  options?: { motifPerte?: string }
): Promise<Affaire | null> {
  const affaire = await prisma.affaire.findUnique({ where: { id: affaireId } });
  if (!affaire || !ETAPE_PAR_ID[statut]) return null;
  const maj = await prisma.affaire.update({
    where: { id: affaireId },
    data: {
      statut,
      motifPerte: statut === "perdu" ? options?.motifPerte ?? affaire.motifPerte : "",
    },
  });
  await journaliser(
    affaire.contactId,
    "note",
    `Affaire « ${affaire.intitule} » : ${ETAPE_PAR_ID[statut].label}` +
      (statut === "perdu" && maj.motifPerte ? ` (${maj.motifPerte})` : ""),
    { auteur: "gerant" }
  );
  return maj;
}
