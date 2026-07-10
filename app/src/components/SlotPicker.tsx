"use client";

// Calendrier de créneaux (style Calendly/Planity) : uniquement les disponibilités réelles.
import { useEffect, useState } from "react";

type DaySlots = { date: string; slots: string[] };

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
}: {
  selected: string | null;
  onSelect: (iso: string) => void;
}) {
  const [days, setDays] = useState<DaySlots[] | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/availability")
      .then((r) => r.json())
      .then((data) => {
        setDays(data.days ?? []);
        if (data.days?.length) setActiveDay(data.days[0].date);
      })
      .catch(() => setError(true));
  }, []);

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
        Aucun créneau disponible pour le moment. Réessayez un peu plus tard ou appelez-nous.
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
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {current.slots.map((iso) => (
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
    </div>
  );
}
