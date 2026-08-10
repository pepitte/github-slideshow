"use client";

// Disponibilités : statut, créneaux devis, dates cochées dans le calendrier.
// C'est ce planning qui alimente l'attribution automatique des chantiers.
import { useEffect, useMemo, useState } from "react";
import { PRO_STATUS_META, PRO_STATUS_ORDER } from "@/lib/proStatus";
import { ymd } from "../shared";

type Pro = {
  name: string;
  email: string;
  phone: string;
  baseCity: string;
  basePostalCode: string;
  radiusKm: number;
  status: string;
  availableDays: number;
  datesJson: string;
  devisSlotsJson: string;
  note: string;
};

// Créneaux devis proposés aux clients : fin de journée, toutes les 30 min.
const DEVIS_SLOTS = ["16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30"];

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export default function ProDisponibilitesPage() {
  const [pro, setPro] = useState<Pro | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [devisSlots, setDevisSlots] = useState<string[]>([]);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
          setDevisSlots(JSON.parse(pro.devisSlotsJson) || []);
        } catch {}
      })
      .catch(() => {});
  }, []);

  const set = (patch: Partial<Pro>) => setPro((p) => (p ? { ...p, ...patch } : p));

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

  function toggleDate(d: string) {
    setDates((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  async function save() {
    if (!pro) return;
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/pro/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: pro.name,
        phone: pro.phone,
        baseCity: pro.baseCity,
        basePostalCode: pro.basePostalCode,
        radiusKm: pro.radiusKm,
        availableDays: pro.availableDays,
        status: pro.status,
        note: pro.note,
        dates,
        devisSlots,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  if (!pro) {
    return <main className="mx-auto max-w-lg px-4 py-10 text-center text-leaf-800/60">Chargement…</main>;
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-1 text-xl font-bold">Mes disponibilités</h1>
      <p className="mb-4 text-sm text-leaf-800/60">
        Les chantiers réservés par les clients de votre secteur sont attribués
        automatiquement au professionnel disponible le plus proche : cochez vos dates
        pour en recevoir.
      </p>

      {/* Statut */}
      <section className="card space-y-3">
        <h2 className="font-bold">Votre statut</h2>
        <div className="grid gap-2">
          {PRO_STATUS_ORDER.map((id) => {
            const meta = PRO_STATUS_META[id];
            const active = pro.status === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => set({ status: id })}
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

      {/* Créneaux devis (fin de journée, toutes les 30 min) */}
      <section className="card mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Créneaux devis</h2>
          <span className="text-sm text-leaf-800/60">{devisSlots.length} validé(s)</span>
        </div>
        <p className="text-sm text-leaf-800/70">
          Validez les horaires de fin de journée où vous pouvez assurer une visite devis.
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {DEVIS_SLOTS.map((t) => {
            const on = devisSlots.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setDevisSlots((prev) =>
                    prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].sort()
                  )
                }
                className={`rounded-xl border py-3 text-sm font-semibold transition ${
                  on
                    ? "border-leaf-600 bg-leaf-600 text-white"
                    : "border-leaf-200 bg-white text-leaf-900"
                }`}
              >
                {t.replace(":", "h")}
              </button>
            );
          })}
        </div>
      </section>

      {/* Dates disponibles */}
      <section className="card mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Dates disponibles</h2>
          <span className="text-sm text-leaf-800/60">{dates.length} jour(s) sélectionné(s)</span>
        </div>
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
          {days.map((d, i) =>
            d === null ? (
              <span key={i} />
            ) : (
              <button
                key={d}
                type="button"
                disabled={d < todayStr}
                onClick={() => toggleDate(d)}
                className={`aspect-square rounded-lg text-sm font-medium transition ${
                  dates.includes(d)
                    ? "bg-leaf-600 text-white"
                    : d < todayStr
                      ? "text-leaf-800/25"
                      : "bg-leaf-50 text-leaf-900 hover:bg-leaf-100"
                }`}
              >
                {Number(d.slice(8))}
              </button>
            )
          )}
        </div>
      </section>

      <div className="mt-4 flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer mes disponibilités"}
        </button>
        {saved && <span className="text-sm font-semibold text-leaf-700">✓ Enregistré</span>}
      </div>
    </main>
  );
}
