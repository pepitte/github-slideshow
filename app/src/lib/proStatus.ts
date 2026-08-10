// Disponibilité d'un professionnel : elle découle UNIQUEMENT de ce qu'il a
// coché dans son agenda. Il n'y a plus de statut « indisponible » (décision du
// client, 10 août) : ne rien déclarer suffit à ne rien recevoir. Les deux modes
// ci-dessous ne servent qu'à choisir l'agenda qu'on remplit — ils ne bloquent
// aucune attribution.

export type ProMode = "devis" | "chantier";

export const MODE_META: Record<ProMode, { label: string; court: string; dot: string; badge: string }> = {
  devis: {
    label: "Visites devis",
    court: "Devis",
    dot: "#3b82f6", // 🔵 — même code couleur que les RDV devis
    badge: "bg-blue-100 text-blue-800",
  },
  chantier: {
    label: "Chantiers",
    court: "Chantiers",
    dot: "#22c55e", // 🟢 — même code couleur que les chantiers
    badge: "bg-green-100 text-green-800",
  },
};

export const MODE_ORDER: ProMode[] = ["devis", "chantier"];

// `Pro.status` ne sert plus qu'à retenir le dernier onglet ouvert par le pro
// (les anciennes valeurs « indisponible » / « sous_confirmation » retombent
// simplement sur l'agenda des chantiers).
export function modeOf(status: string): ProMode {
  return status === "disponible_devis" ? "devis" : "chantier";
}

export function statusOfMode(mode: ProMode): string {
  return mode === "devis" ? "disponible_devis" : "disponible_chantier";
}

/** ["2026-08-12", …] — jours de chantier déclarés. */
export function parseDates(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((d): d is string => typeof d === "string") : [];
  } catch {
    return [];
  }
}

/** {"2026-08-13":["10:00","17:00"], …} — créneaux de visite déclarés par jour. */
export function parseDispo(json: string): Record<string, string[]> {
  try {
    const obj = JSON.parse(json);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
    const out: Record<string, string[]> = {};
    for (const [day, slots] of Object.entries(obj)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(slots)) continue;
      const clean = (slots as unknown[]).filter(
        (t): t is string => typeof t === "string" && /^\d{2}:\d{2}$/.test(t)
      );
      if (clean.length) out[day] = Array.from(new Set(clean)).sort();
    }
    return out;
  } catch {
    return {};
  }
}

export type DispoResume = {
  /** Jours de chantier à venir. */
  jours: string[];
  /** Jours comportant au moins un créneau de visite à venir. */
  joursDevis: string[];
  /** Nombre total de créneaux de visite à venir. */
  creneaux: number;
  /** Au moins une disponibilité déclarée à venir. */
  actif: boolean;
  label: string;
  detail: string;
  dot: string;
  badge: string;
};

/**
 * Ce que le professionnel a réellement déclaré à partir d'aujourd'hui — c'est
 * ce que le gérant doit voir, à la place d'un statut déclaratif.
 */
export function dispoResume(
  pro: { datesJson: string; devisDispoJson: string },
  today: string
): DispoResume {
  const jours = parseDates(pro.datesJson)
    .filter((d) => d >= today)
    .sort();
  const dispo = parseDispo(pro.devisDispoJson);
  const joursDevis = Object.keys(dispo)
    .filter((d) => d >= today)
    .sort();
  const creneaux = joursDevis.reduce((n, d) => n + dispo[d].length, 0);

  const morceaux = [
    jours.length ? `${jours.length} jour(s) de chantier` : "",
    creneaux ? `${creneaux} créneau(x) de visite` : "",
  ].filter(Boolean);

  if (!jours.length && !creneaux) {
    return {
      jours,
      joursDevis,
      creneaux,
      actif: false,
      label: "Rien de déclaré",
      detail: "Aucune disponibilité à venir",
      dot: "#9ca3af", // gris
      badge: "bg-gray-100 text-gray-600",
    };
  }
  const mode: ProMode = jours.length ? "chantier" : "devis";
  return {
    jours,
    joursDevis,
    creneaux,
    actif: true,
    label: jours.length && creneaux ? "Chantiers + visites" : MODE_META[mode].label,
    detail: morceaux.join(" · "),
    dot: MODE_META[mode].dot,
    badge: MODE_META[mode].badge,
  };
}
