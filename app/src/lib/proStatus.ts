// Statuts de disponibilité d'un professionnel (client + admin).
export const PRO_STATUS_META: Record<
  string,
  { label: string; dot: string; badge: string }
> = {
  disponible_devis: {
    label: "Disponible pour un devis",
    dot: "#3b82f6", // 🔵 — même code couleur que les RDV devis
    badge: "bg-blue-100 text-blue-800",
  },
  disponible_chantier: {
    label: "Disponible pour un chantier",
    dot: "#22c55e", // 🟢 — même code couleur que les chantiers
    badge: "bg-green-100 text-green-800",
  },
  sous_confirmation: {
    label: "Disponible sous confirmation",
    dot: "#f59e0b", // 🟠
    badge: "bg-amber-100 text-amber-800",
  },
  indisponible: {
    label: "Indisponible",
    dot: "#ef4444", // 🔴
    badge: "bg-red-100 text-red-700",
  },
};

export const PRO_STATUS_ORDER = [
  "disponible_devis",
  "disponible_chantier",
  "sous_confirmation",
  "indisponible",
];
