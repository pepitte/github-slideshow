"use client";

// Espace professionnel : statut de disponibilité, dates, nombre de jours, rayon.
import { useEffect, useMemo, useState } from "react";
import { PRO_STATUS_META, PRO_STATUS_ORDER } from "@/lib/proStatus";

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
  note: string;
};

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ProDashboard() {
  const [pro, setPro] = useState<Pro | null>(null);
  const [dates, setDates] = useState<string[]>([]);
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

  async function logout() {
    await fetch("/api/pro/logout", { method: "POST" });
    window.location.href = "/pro/login";
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
    <main className="mx-auto max-w-lg px-4 py-6 sm:max-w-2xl">
      <div className="mb-5 flex items-center justify-between border-b border-leaf-100 pb-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-leaf-800/50">Espace professionnel</p>
          <h1 className="text-lg font-bold">{pro.name}</h1>
        </div>
        <button onClick={logout} className="text-sm text-leaf-800/60 hover:text-leaf-800">
          Déconnexion
        </button>
      </div>

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

      {/* Détails */}
      <section className="card mt-4 space-y-3">
        <h2 className="font-bold">Vos informations</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Nombre de journées disponibles</label>
            <input
              className="input"
              type="number"
              min={0}
              value={pro.availableDays}
              onChange={(e) => set({ availableDays: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Rayon d&apos;intervention (km)</label>
            <input
              className="input"
              type="number"
              min={0}
              value={pro.radiusKm}
              onChange={(e) => set({ radiusKm: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Ville de départ</label>
            <input className="input" value={pro.baseCity} onChange={(e) => set({ baseCity: e.target.value })} />
          </div>
          <div>
            <label className="label">Code postal</label>
            <input
              className="input"
              inputMode="numeric"
              maxLength={5}
              value={pro.basePostalCode}
              onChange={(e) => set({ basePostalCode: e.target.value.replace(/\D/g, "") })}
            />
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input className="input" type="tel" value={pro.phone} onChange={(e) => set({ phone: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Note (facultatif)</label>
          <textarea
            className="input min-h-[70px]"
            placeholder="Précisions sur vos disponibilités, matériel, spécialités…"
            value={pro.note}
            onChange={(e) => set({ note: e.target.value })}
          />
        </div>
      </section>

      <div className="sticky bottom-4 mt-4 flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer mes disponibilités"}
        </button>
        {saved && <span className="text-sm font-semibold text-leaf-700">✓ Enregistré</span>}
      </div>
    </main>
  );
}
