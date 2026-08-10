"use client";

// Disponibilités : statut (3 choix), puis selon le statut —
//  - chantier : un tap sur un jour = disponible (vert) ;
//  - devis : un tap sur un jour ouvre le panneau du jour (créneaux de 30 min
//    + raccourcis Fin de journée / Matin / Après-midi).
// Tout s'enregistre immédiatement : aucun bouton « Enregistrer ».
import { useEffect, useMemo, useRef, useState } from "react";
import { PRO_STATUS_META, PRO_STATUS_ORDER } from "@/lib/proStatus";
import { ymd } from "../shared";

type Pro = {
  name: string;
  phone: string;
  baseCity: string;
  basePostalCode: string;
  radiusKm: number;
  status: string;
  availableDays: number;
  datesJson: string;
  devisDispoJson: string;
  note: string;
};

// Créneaux proposables : de 8h00 à 19h30, toutes les 30 min.
const CHIPS: string[] = [];
for (let m = 8 * 60; m <= 19 * 60 + 30; m += 30) {
  CHIPS.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
}
const PRESETS: { label: string; slots: string[] }[] = [
  { label: "Fin de journée", slots: CHIPS.filter((t) => t >= "16:30") },
  { label: "Matin", slots: CHIPS.filter((t) => t < "12:00") },
  { label: "Après-midi", slots: CHIPS.filter((t) => t >= "13:00" && t < "16:30") },
];

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export default function ProDisponibilitesPage() {
  const [pro, setPro] = useState<Pro | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [dispo, setDispo] = useState<Record<string, string[]>>({});
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [jourOuvert, setJourOuvert] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/pro/me")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/pro/login";
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then(({ pro }) => {
        setPro(pro);
        try {
          setDates(JSON.parse(pro.datesJson) || []);
        } catch {}
        try {
          const parsed = JSON.parse(pro.devisDispoJson || "{}");
          setDispo(parsed && typeof parsed === "object" ? parsed : {});
        } catch {}
      })
      .catch(() => {});
  }, []);

  /** Enregistre immédiatement (léger regroupement pour les taps rapprochés). */
  function persist(patch: Record<string, unknown>) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const res = await fetch("/api/pro/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    }, 400);
  }

  const set = (patch: Partial<Pro>) => setPro((p) => (p ? { ...p, ...patch } : p));

  function changeStatus(id: string) {
    set({ status: id });
    setJourOuvert(null);
    persist({ status: id });
  }

  function toggleJourChantier(d: string) {
    const next = dates.includes(d) ? dates.filter((x) => x !== d) : [...dates, d].sort();
    setDates(next);
    persist({ dates: next });
  }

  function setJourDevis(d: string, slots: string[]) {
    const next = { ...dispo };
    if (slots.length) next[d] = Array.from(new Set(slots)).sort();
    else delete next[d];
    setDispo(next);
    persist({ devisDispo: next });
  }

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const startWeekday = (first.getDay() + 6) % 7; // lundi = 0
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(ymd(new Date(month.getFullYear(), month.getMonth(), d)));
    return cells;
  }, [month]);

  const todayStr = ymd(new Date());

  if (!pro) {
    return <main className="mx-auto max-w-lg px-4 py-10 text-center text-leaf-800/60">Chargement…</main>;
  }

  const modeDevis = pro.status === "disponible_devis";
  const modeChantier = pro.status === "disponible_chantier";
  const slotsOuverts = jourOuvert ? dispo[jourOuvert] ?? [] : [];

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Mes disponibilités</h1>
          <p className="text-sm text-leaf-800/60">Tout est enregistré automatiquement.</p>
        </div>
        {saved && <span className="text-sm font-semibold text-leaf-700">✓ Enregistré</span>}
      </div>

      {/* Statut : 3 choix */}
      <section className="card space-y-2">
        <h2 className="font-bold">Votre statut</h2>
        <div className="grid gap-2">
          {PRO_STATUS_ORDER.map((id) => {
            const meta = PRO_STATUS_META[id];
            const active = pro.status === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => changeStatus(id)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                  active ? "border-leaf-600 bg-leaf-50 ring-2 ring-leaf-500/25" : "border-leaf-200 bg-white"
                }`}
              >
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: meta.dot }} />
                {meta.label}
              </button>
            );
          })}
        </div>
      </section>

      {pro.status === "indisponible" ? (
        <p className="card mt-4 py-6 text-center text-sm text-leaf-800/60">
          Vous êtes indisponible : aucun rendez-vous ne vous sera attribué.
          <br />
          Vos dates et créneaux sont conservés — ils réapparaîtront dès que vous
          redeviendrez disponible.
        </p>
      ) : (
        <section className="card mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">{modeChantier ? "Mes jours de chantier" : "Mes créneaux de visite"}</h2>
            <span className="text-sm text-leaf-800/60">
              {modeChantier
                ? `${dates.length} jour(s)`
                : `${Object.keys(dispo).length} jour(s) renseigné(s)`}
            </span>
          </div>
          <p className="text-sm text-leaf-800/70">
            {modeChantier
              ? "Touchez un jour : vous êtes disponible pour un chantier (journée entière, début 8h00). Retouchez pour retirer."
              : "Touchez un jour pour indiquer vos heures : un raccourci « Fin de journée » pour le cas habituel, ou vos trous en journée, à la demi-heure."}
          </p>

          <div className="flex items-center justify-between">
            <button className="btn-secondary !px-3 !py-1.5" onClick={() => setMonth(addMonths(month, -1))}>
              ←
            </button>
            <span className="font-semibold capitalize">
              {month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </span>
            <button className="btn-secondary !px-3 !py-1.5" onClick={() => setMonth(addMonths(month, 1))}>
              →
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-leaf-800/50">
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              if (d === null) return <span key={i} />;
              const past = d < todayStr;
              if (modeChantier) {
                const on = dates.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={past}
                    onClick={() => toggleJourChantier(d)}
                    className={`aspect-square rounded-lg text-sm font-medium transition ${
                      on
                        ? "bg-leaf-600 text-white"
                        : past
                          ? "text-leaf-800/25"
                          : "bg-leaf-50 text-leaf-900 hover:bg-leaf-100"
                    }`}
                  >
                    {Number(d.slice(8))}
                  </button>
                );
              }
              // Mode devis : pastille bleue + nombre de créneaux du jour
              const n = dispo[d]?.length ?? 0;
              const ouvert = jourOuvert === d;
              return (
                <button
                  key={d}
                  type="button"
                  disabled={past}
                  onClick={() => setJourOuvert(ouvert ? null : d)}
                  className={`relative aspect-square rounded-lg text-sm font-medium transition ${
                    ouvert
                      ? "bg-blue-600 text-white ring-2 ring-blue-400"
                      : n > 0
                        ? "bg-blue-100 text-blue-900"
                        : past
                          ? "text-leaf-800/25"
                          : "bg-leaf-50 text-leaf-900 hover:bg-leaf-100"
                  }`}
                >
                  {Number(d.slice(8))}
                  {n > 0 && !ouvert && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold text-white">
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Panneau du jour (mode devis) */}
          {modeDevis && jourOuvert && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
              <p className="mb-2 text-sm font-bold capitalize text-blue-900">
                {new Date(`${jourOuvert}T12:00:00`).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
                <span className="ml-2 font-normal text-blue-900/70">
                  {slotsOuverts.length} créneau(x)
                </span>
              </p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setJourDevis(jourOuvert, Array.from(new Set([...slotsOuverts, ...p.slots])))}
                    className="rounded-full border border-blue-300 bg-white px-3 py-1 text-xs font-semibold text-blue-800"
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setJourDevis(jourOuvert, [])}
                  className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600"
                >
                  Effacer
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {CHIPS.map((t) => {
                  const on = slotsOuverts.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() =>
                        setJourDevis(
                          jourOuvert,
                          on ? slotsOuverts.filter((x) => x !== t) : [...slotsOuverts, t]
                        )
                      }
                      className={`rounded-lg border py-1.5 text-xs font-semibold transition ${
                        on ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 bg-white text-blue-900"
                      }`}
                    >
                      {t.replace(":", "h")}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
