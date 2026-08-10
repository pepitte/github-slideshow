"use client";

// Calendrier de réservation (style Calendly/Planity), uniquement les disponibilités réelles.
// - devis : jours + créneaux de 30 min en fin de journée
// - chantier : sélection d'UN OU PLUSIEURS jours (départ 8h00).
//   1 jour → formule « Demi-journée (8h-12h) » ou « Journée entière » ;
//   plusieurs jours → journée entière pour chacun.
import { useEffect, useState } from "react";

type DevisDay = { date: string; slots: string[] };
type ChantierDay = { date: string; startAt: string; demi: boolean; journee: boolean };

export type ChantierSelection = {
  days: string[]; // ISO des débuts (8h00) des jours choisis
  duration: "demi" | "journee" | null;
};

function dayLabel(dateStr: string): { weekday: string; day: string } {
  const d = new Date(`${dateStr}T12:00:00`);
  return {
    weekday: d.toLocaleDateString("fr-FR", { weekday: "short" }),
    day: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
  };
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SlotPicker({
  selected,
  onSelect,
  token,
  kind = "devis",
  cp,
  chantier,
  onChantierChange,
}: {
  /** Devis : créneau sélectionné (ISO). */
  selected?: string | null;
  /** Devis : sélection d'un créneau. */
  onSelect?: (iso: string) => void;
  /** Lien d'annulation : exclut le RDV du client du calcul (report). */
  token?: string;
  kind?: "devis" | "chantier";
  /** Code postal du client : seuls les jours couverts par un pro à portée sont proposés. */
  cp?: string;
  /** Chantier : sélection courante (jours + formule). */
  chantier?: ChantierSelection;
  onChantierChange?: (sel: ChantierSelection) => void;
}) {
  const [mode, setMode] = useState<"devis" | "chantier">(kind);
  const [days, setDays] = useState<(DevisDay | ChantierDay)[] | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("kind", kind);
    if (token) params.set("token", token);
    if (cp && /^\d{5}$/.test(cp)) params.set("cp", cp);
    setDays(null);
    fetch(`/api/availability?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setMode(data.kind === "chantier" ? "chantier" : "devis");
        setDays(data.days ?? []);
        if (data.days?.length) setActiveDay(data.days[0].date);
      })
      .catch(() => setError(true));
  }, [token, kind, cp]);

  if (error) {
    return <p className="text-sm text-red-600">Impossible de charger les créneaux. Réessayez.</p>;
  }
  if (days === null) {
    return (
      <div className="flex items-center gap-2 py-8 text-leaf-800/60">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-leaf-300 border-t-leaf-600" />
        Recherche des disponibilités…
      </div>
    );
  }
  if (days.length === 0) {
    return (
      <p className="py-6 text-sm text-leaf-800/70">
        Aucune disponibilité pour le moment. Réessayez un peu plus tard ou appelez-nous.
      </p>
    );
  }

  // ---------- Mode DEVIS : un jour actif + grille de créneaux ----------
  if (mode === "devis") {
    const current = (days as DevisDay[]).find((d) => d.date === activeDay) ?? (days as DevisDay[])[0];
    return (
      <div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-3">
          {(days as DevisDay[]).map((d) => {
            const { weekday, day } = dayLabel(d.date);
            const isActive = d.date === current.date;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => setActiveDay(d.date)}
                className={`flex min-w-[4.5rem] flex-col items-center rounded-xl border px-3 py-2 text-sm transition ${
                  isActive
                    ? "border-leaf-600 bg-leaf-600 text-white"
                    : "border-leaf-200 bg-white text-leaf-900"
                }`}
              >
                <span className="capitalize opacity-75">{weekday}</span>
                <span className="font-semibold capitalize">{day}</span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {current.slots.map((iso) => (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect?.(iso)}
              className={`rounded-xl border py-3 text-sm font-semibold transition ${
                selected === iso
                  ? "border-leaf-600 bg-leaf-600 text-white"
                  : "border-leaf-200 bg-white text-leaf-900 active:bg-leaf-50"
              }`}
            >
              {timeLabel(iso)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---------- Mode CHANTIER : multi-sélection de jours ----------
  const sel: ChantierSelection = chantier ?? { days: [], duration: null };
  const chDays = days as ChantierDay[];

  function toggleDay(d: ChantierDay) {
    let nextDays: string[];
    if (sel.days.includes(d.startAt)) {
      nextDays = sel.days.filter((x) => x !== d.startAt);
    } else if (!d.journee) {
      // Jour en demi-journée seulement : sélectionnable uniquement seul.
      nextDays = [d.startAt];
    } else {
      // Ajout : les jours déjà choisis doivent supporter la journée entière.
      const keep = sel.days.filter((x) => chDays.find((c) => c.startAt === x)?.journee);
      nextDays = [...keep, d.startAt].sort();
    }
    const nextDuration =
      nextDays.length > 1 ? "journee" : nextDays.length === 1 ? sel.duration : null;
    onChantierChange?.({ days: nextDays, duration: nextDuration });
  }

  const single =
    sel.days.length === 1 ? chDays.find((c) => c.startAt === sel.days[0]) : undefined;

  return (
    <div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-3">
        {chDays.map((d) => {
          const { weekday, day } = dayLabel(d.date);
          const isOn = sel.days.includes(d.startAt);
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => toggleDay(d)}
              className={`relative flex min-w-[4.5rem] flex-col items-center rounded-xl border px-3 py-2 text-sm transition ${
                isOn
                  ? "border-leaf-600 bg-leaf-600 text-white"
                  : "border-leaf-200 bg-white text-leaf-900"
              }`}
            >
              <span className="capitalize opacity-75">{weekday}</span>
              <span className="font-semibold capitalize">{day}</span>
              {isOn && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-leaf-800 text-[11px] text-white">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {sel.days.length === 0 && (
        <p className="py-2 text-sm text-leaf-800/70">
          Touchez un ou plusieurs jours pour votre chantier.
        </p>
      )}

      {sel.days.length === 1 && single && (
        <div className="grid gap-2">
          {single.demi && (
            <button
              type="button"
              onClick={() => onChantierChange?.({ ...sel, duration: "demi" })}
              className={`rounded-xl border px-4 py-3.5 text-left transition ${
                sel.duration === "demi"
                  ? "border-leaf-600 bg-leaf-600 text-white"
                  : "border-leaf-200 bg-white text-leaf-900 active:bg-leaf-50"
              }`}
            >
              <span className="block text-sm font-bold">Demi-journée</span>
              <span className={`block text-sm ${sel.duration === "demi" ? "text-white/80" : "text-leaf-800/60"}`}>
                8h00 → 12h00
              </span>
            </button>
          )}
          {single.journee && (
            <button
              type="button"
              onClick={() => onChantierChange?.({ ...sel, duration: "journee" })}
              className={`rounded-xl border px-4 py-3.5 text-left transition ${
                sel.duration === "journee"
                  ? "border-leaf-600 bg-leaf-600 text-white"
                  : "border-leaf-200 bg-white text-leaf-900 active:bg-leaf-50"
              }`}
            >
              <span className="block text-sm font-bold">Journée entière</span>
              <span className={`block text-sm ${sel.duration === "journee" ? "text-white/80" : "text-leaf-800/60"}`}>
                Début à 8h00
              </span>
            </button>
          )}
        </div>
      )}

      {sel.days.length > 1 && (
        <p className="rounded-xl bg-leaf-50 p-3 text-sm font-medium text-leaf-800">
          {sel.days.length} jours sélectionnés — journée entière (début 8h00) pour chaque jour.
        </p>
      )}
    </div>
  );
}
