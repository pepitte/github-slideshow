"use client";

// Calendrier de réservation (style Calendly/Planity), uniquement les disponibilités réelles.
// - devis : jours + créneaux de 30 min en fin de journée
// - chantier : jours + formule « Demi-journée (8h-12h) » ou « Journée entière » (début 8h)
import { useEffect, useState } from "react";

type DevisDay = { date: string; slots: string[] };
type ChantierDay = { date: string; startAt: string; demi: boolean; journee: boolean };

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
  selectedDuration = null,
}: {
  selected: string | null;
  /** devis : onSelect(iso). chantier : onSelect(iso du jour à 8h, "demi"|"journee"). */
  onSelect: (iso: string, duration?: "demi" | "journee") => void;
  /** Lien d'annulation : exclut le RDV du client du calcul (report). */
  token?: string;
  /** Type de rendez-vous (devis = fin de journée, chantier = journée dès 8h). */
  kind?: "devis" | "chantier";
  /** Chantier : formule actuellement sélectionnée. */
  selectedDuration?: "demi" | "journee" | null;
}) {
  const [mode, setMode] = useState<"devis" | "chantier">(kind);
  const [days, setDays] = useState<(DevisDay | ChantierDay)[] | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("kind", kind);
    if (token) params.set("token", token);
    setDays(null);
    fetch(`/api/availability?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setMode(data.kind === "chantier" ? "chantier" : "devis");
        setDays(data.days ?? []);
        if (data.days?.length) setActiveDay(data.days[0].date);
      })
      .catch(() => setError(true));
  }, [token, kind]);

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

  const current = days.find((d) => d.date === activeDay) ?? days[0];

  return (
    <div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-3">
        {days.map((d) => {
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

      {mode === "devis" ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {(current as DevisDay).slots.map((iso) => (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
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
      ) : (
        <div className="grid gap-2">
          {(() => {
            const day = current as ChantierDay;
            const isOn = (dur: "demi" | "journee") =>
              selected === day.startAt && selectedDuration === dur;
            return (
              <>
                {day.demi && (
                  <button
                    type="button"
                    onClick={() => onSelect(day.startAt, "demi")}
                    className={`rounded-xl border px-4 py-3.5 text-left transition ${
                      isOn("demi")
                        ? "border-leaf-600 bg-leaf-600 text-white"
                        : "border-leaf-200 bg-white text-leaf-900 active:bg-leaf-50"
                    }`}
                  >
                    <span className="block text-sm font-bold">Demi-journée</span>
                    <span className={`block text-sm ${isOn("demi") ? "text-white/80" : "text-leaf-800/60"}`}>
                      8h00 → 12h00
                    </span>
                  </button>
                )}
                {day.journee && (
                  <button
                    type="button"
                    onClick={() => onSelect(day.startAt, "journee")}
                    className={`rounded-xl border px-4 py-3.5 text-left transition ${
                      isOn("journee")
                        ? "border-leaf-600 bg-leaf-600 text-white"
                        : "border-leaf-200 bg-white text-leaf-900 active:bg-leaf-50"
                    }`}
                  >
                    <span className="block text-sm font-bold">Journée entière</span>
                    <span className={`block text-sm ${isOn("journee") ? "text-white/80" : "text-leaf-800/60"}`}>
                      Début à 8h00
                    </span>
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
