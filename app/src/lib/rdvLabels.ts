// Libellés des rendez-vous côté client : le vocabulaire que voit le particulier
// dans son espace, sur la confirmation et dans les emails. Module pur (aucun
// accès à la base) pour pouvoir être importé par des composants « client ».

export const PROJECT_LABELS: Record<string, string> = {
  entretien: "Entretien de jardin général",
  taille_haie: "Taille de haie",
  debroussaillage: "Débroussaillage",
  contrat_annuel: "Contrat d'entretien à l'année",
  autre: "Autre projet",
};

export type KindMeta = {
  /** Titre affiché en tête de carte. */
  titre: string;
  /** Version courte, pour les pastilles. */
  court: string;
  /** Ce qui va concrètement se passer — rassure le client. */
  explication: string;
  /** Classes Tailwind : pastille, filet de gauche, fond de l'entête. */
  pastille: string;
  filet: string;
};

// Bleu = visite de devis, vert = chantier : la même convention que l'agenda
// du gérant, pour que tout le monde parle des mêmes couleurs.
export const KIND_META: Record<string, KindMeta> = {
  devis: {
    titre: "Visite pour devis",
    court: "Devis",
    explication:
      "Nous venons voir votre jardin sur place pour évaluer le travail, puis vous recevez votre devis. C'est gratuit et sans engagement.",
    pastille: "bg-blue-100 text-blue-800",
    filet: "border-l-4 border-l-blue-500",
  },
  chantier: {
    titre: "Chantier",
    court: "Chantier",
    explication:
      "Nos paysagistes interviennent chez vous. Pensez à laisser l'accès au jardin possible ce jour-là.",
    pastille: "bg-leaf-100 text-leaf-800",
    filet: "border-l-4 border-l-leaf-600",
  },
};

export function kindMeta(kind: string): KindMeta {
  return KIND_META[kind] ?? KIND_META.devis;
}

export type StatutClient = { label: string; classe: string };

/**
 * Le statut, dit avec les mots du client. Le même code interne ne veut pas dire
 * la même chose pour une visite et pour un chantier — d'où le `kind`.
 */
export function statutClient(kind: string, status: string, passe: boolean): StatutClient {
  const gris = "bg-leaf-100 text-leaf-800/70";
  const vert = "bg-leaf-100 text-leaf-800";
  const ambre = "bg-amber-100 text-amber-800";
  switch (status) {
    case "annule":
      return { label: "Annulé", classe: gris };
    case "devis_envoye":
      return { label: "Devis envoyé", classe: ambre };
    case "gagne":
      return kind === "chantier"
        ? { label: passe ? "Terminé" : "Confirmé", classe: vert }
        : { label: "Devis accepté", classe: vert };
    case "perdu":
      return { label: "Sans suite", classe: gris };
    default:
      if (passe) {
        return { label: kind === "chantier" ? "Terminé" : "Visite effectuée", classe: gris };
      }
      return { label: kind === "chantier" ? "Confirmé" : "Visite prévue", classe: vert };
  }
}

const MIN = 60 * 1000;

/**
 * Le créneau en clair : « 17h00 → 17h30 (environ 30 min) » pour une visite,
 * « 8h00 → 12h00 · demi-journée » pour un chantier.
 */
export function creneauLabel(kind: string, startAt: string | null, endAt: string | null): string {
  if (!startAt) return "";
  const heure = (iso: string) =>
    new Date(iso).toLocaleTimeString("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      minute: "2-digit",
    });
  const debut = heure(startAt);
  if (!endAt) return debut;
  const minutes = Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / MIN);
  if (kind === "chantier") {
    const formule = minutes <= 5 * 60 ? "demi-journée" : "journée entière";
    return `${debut} → ${heure(endAt)} · ${formule}`;
  }
  return `${debut} · environ ${minutes} min`;
}

/** « aujourd'hui », « demain », « dans 3 jours »… ou rien si c'est loin. */
export function delaiLabel(startAt: string | null, maintenant = Date.now()): string {
  if (!startAt) return "";
  const jour = (t: number) => {
    const d = new Date(t);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  };
  const jours = Math.round((jour(new Date(startAt).getTime()) - jour(maintenant)) / 86400000);
  if (jours < 0) return "";
  if (jours === 0) return "aujourd'hui";
  if (jours === 1) return "demain";
  if (jours <= 14) return `dans ${jours} jours`;
  return "";
}

/** « 0651525354 » → « 06 51 52 53 54 » : lisible d'un coup d'œil. */
export function telFr(t: string): string {
  const d = (t || "").replace(/\D/g, "");
  if (d.length === 10) return d.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  return t;
}

/** Date longue en français, fuseau de Paris. */
export function dateLongue(startAt: string | null): string {
  if (!startAt) return "Date à définir";
  return new Date(startAt).toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
