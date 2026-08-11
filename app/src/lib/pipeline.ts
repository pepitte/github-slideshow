// Pipeline commercial d'une affaire. Un seul champ `statut`, dont les valeurs
// se lisent en trois bandes : commercial, exécution, clôturé.
//
// Deux principes issus de la note d'architecture :
//   1. « Refusé », « pas intéressé » et « pas de réponse » ne sont pas des
//      étapes mais des MOTIFS de perte — sinon le pipeline se remplit de
//      colonnes mortes et les pertes deviennent incomptables ;
//   2. « Accepté » n'est pas une fin : le devis accepté déclenche le chantier.

export type Groupe = "commercial" | "execution" | "clos_gagne" | "clos_perdu" | "clos_neutre";

export type Etape = {
  id: string;
  label: string;
  court: string;
  groupe: Groupe;
  /** Ordre d'affichage dans le pipeline. */
  ordre: number;
  aide: string;
};

export const ETAPES: Etape[] = [
  { id: "nouvelle", label: "Nouvelle demande", court: "Nouvelle", groupe: "commercial", ordre: 1,
    aide: "Contact entrant à qualifier" },
  { id: "visite_planifiee", label: "Visite planifiée", court: "Visite", groupe: "commercial", ordre: 2,
    aide: "Rendez-vous devis pris" },
  { id: "devis_a_faire", label: "Devis à faire", court: "À chiffrer", groupe: "commercial", ordre: 3,
    aide: "Visite passée, chiffrage à produire" },
  { id: "devis_envoye", label: "Devis envoyé", court: "Envoyé", groupe: "commercial", ordre: 4,
    aide: "Devis transmis au client" },
  { id: "relance", label: "En relance", court: "Relance", groupe: "commercial", ordre: 5,
    aide: "Sans réponse, relance programmée" },
  { id: "gagne", label: "Gagné, à planifier", court: "Gagné", groupe: "execution", ordre: 6,
    aide: "Devis accepté, chantier à caler" },
  { id: "chantier_planifie", label: "Chantier planifié", court: "Planifié", groupe: "execution", ordre: 7,
    aide: "Dates posées, paysagiste attribué" },
  { id: "chantier_en_cours", label: "Chantier en cours", court: "En cours", groupe: "execution", ordre: 8,
    aide: "Travaux démarrés" },
  { id: "termine", label: "Terminé", court: "Terminé", groupe: "execution", ordre: 9,
    aide: "Travaux finis" },
  { id: "facture", label: "Facturé", court: "Facturé", groupe: "clos_gagne", ordre: 10,
    aide: "Facture émise" },
  { id: "paye", label: "Payé", court: "Payé", groupe: "clos_gagne", ordre: 11,
    aide: "Facture réglée — affaire close" },
  { id: "perdu", label: "Perdu", court: "Perdu", groupe: "clos_perdu", ordre: 12,
    aide: "Sans suite — indiquez le motif" },
  { id: "annule", label: "Annulé", court: "Annulé", groupe: "clos_neutre", ordre: 13,
    aide: "Annulation — neutre dans les statistiques" },
];

export const ETAPE_PAR_ID: Record<string, Etape> = Object.fromEntries(
  ETAPES.map((e) => [e.id, e])
);

export const STATUTS_VALIDES = ETAPES.map((e) => e.id);

/** Motifs de perte : c'est le « pourquoi », séparé de l'étape. */
export const MOTIFS_PERTE: Record<string, string> = {
  refuse: "Devis refusé",
  pas_interesse: "Pas intéressé",
  pas_de_reponse: "Pas de réponse",
  trop_cher: "Trop cher",
  concurrent: "Parti chez un concurrent",
  hors_zone: "Hors zone d'intervention",
  injoignable: "Injoignable",
  autre: "Autre",
};

/** Une affaire encore vivante : elle a sa place dans le pipeline. */
export function estActive(statut: string): boolean {
  const g = ETAPE_PAR_ID[statut]?.groupe;
  return g === "commercial" || g === "execution";
}

/** Compte au numérateur du taux de transformation. */
export function estGagnee(statut: string): boolean {
  const g = ETAPE_PAR_ID[statut]?.groupe;
  return g === "execution" || g === "clos_gagne";
}

/** Compte au dénominateur du taux de transformation. */
export function estPerdue(statut: string): boolean {
  return ETAPE_PAR_ID[statut]?.groupe === "clos_perdu";
}

/**
 * « Annulé » n'est ni gagné ni perdu : un client qui déménage n'est pas une
 * affaire perdue commercialement, la compter comme telle dégraderait le taux
 * sans que le gérant puisse agir.
 */
export function compteDansLeTaux(statut: string): boolean {
  return estGagnee(statut) || estPerdue(statut);
}

export const COULEURS_GROUPE: Record<Groupe, { puce: string; badge: string; libelle: string }> = {
  commercial: { puce: "#2563eb", badge: "bg-blue-100 text-blue-800", libelle: "Commercial" },
  execution: { puce: "#16a34a", badge: "bg-green-100 text-green-800", libelle: "Exécution" },
  clos_gagne: { puce: "#15803d", badge: "bg-green-200 text-green-900", libelle: "Gagné et clos" },
  clos_perdu: { puce: "#b91c1c", badge: "bg-red-100 text-red-700", libelle: "Perdu" },
  clos_neutre: { puce: "#9ca3af", badge: "bg-gray-200 text-gray-700", libelle: "Annulé" },
};

/** Correspondance entre les anciens statuts de RDV et les nouvelles étapes. */
export const REPRISE_STATUTS: Record<string, string> = {
  a_faire: "nouvelle",
  devis_envoye: "devis_envoye",
  gagne: "gagne",
  perdu: "perdu",
  annule: "annule",
};
