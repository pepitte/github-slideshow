"use client";

// Espace professionnel : statut de disponibilité, dates, nombre de jours, rayon.
import { useEffect, useMemo, useState } from "react";
import { PRO_STATUS_META, PRO_STATUS_ORDER } from "@/lib/proStatus";
import AgendaView from "@/components/AgendaView";
import PhotoUpload from "@/components/PhotoUpload";

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
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ProDashboard() {
  const [pro, setPro] = useState<Pro | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [devisSlots, setDevisSlots] = useState<string[]>([]);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Pointage du jour (arrivée / départ) + photos avant/après du chantier
  const [pointage, setPointage] = useState<{ arrival: string; departure: string; validated: boolean } | null>(null);
  const [pointing, setPointing] = useState(false);
  const [photosBefore, setPhotosBefore] = useState<string[]>([]);
  const [photosAfter, setPhotosAfter] = useState<string[]>([]);
  const [photosSaved, setPhotosSaved] = useState(false);

  useEffect(() => {
    fetch("/api/pro/pointage")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setPointage(data);
        setPhotosBefore(data.photosBefore ?? []);
        setPhotosAfter(data.photosAfter ?? []);
      })
      .catch(() => {});
  }, []);

  async function savePhotos(before: string[], after: string[]) {
    setPhotosBefore(before);
    setPhotosAfter(after);
    try {
      const res = await fetch("/api/pro/pointage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photosBefore: before, photosAfter: after }),
      });
      if (res.ok) {
        setPhotosSaved(true);
        setTimeout(() => setPhotosSaved(false), 2500);
      }
    } catch {}
  }

  async function pointer(action: "arrivee" | "depart") {
    setPointing(true);
    try {
      const res = await fetch("/api/pro/pointage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) setPointage((p) => ({ arrival: data.arrival, departure: data.departure, validated: p?.validated ?? false }));
    } finally {
      setPointing(false);
    }
  }

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
    <main className="mx-auto max-w-lg px-4 py-6 sm:max-w-4xl">
      <div className="mb-5 flex items-center justify-between border-b border-leaf-100 pb-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-leaf-800/50">Espace professionnel</p>
          <h1 className="text-lg font-bold">{pro.name}</h1>
        </div>
        <button onClick={logout} className="text-sm text-leaf-800/60 hover:text-leaf-800">
          Déconnexion
        </button>
      </div>

      {/* Pointage du jour : visible par le gérant dans « Gestion terrain » */}
      <section className="card mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Ma journée</h2>
          {pointage?.validated && (
            <span className="rounded-full bg-leaf-100 px-2.5 py-0.5 text-[11px] font-semibold text-leaf-800">
              Validée par le gérant
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-sand-50 px-3 py-2 text-center">
            <p className="text-xs text-leaf-800/60">Arrivée</p>
            <p className="text-lg font-bold">{pointage?.arrival ? pointage.arrival.replace(":", "h") : "—"}</p>
          </div>
          <div className="rounded-xl bg-sand-50 px-3 py-2 text-center">
            <p className="text-xs text-leaf-800/60">Départ</p>
            <p className="text-lg font-bold">{pointage?.departure ? pointage.departure.replace(":", "h") : "—"}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="btn-secondary flex-1" disabled={pointing} onClick={() => pointer("arrivee")}>
            {pointage?.arrival ? "Corriger l'arrivée" : "Pointer l'arrivée"}
          </button>
          <button className="btn-secondary flex-1" disabled={pointing} onClick={() => pointer("depart")}>
            {pointage?.departure ? "Corriger le départ" : "Pointer le départ"}
          </button>
        </div>
        <p className="text-xs text-leaf-800/50">
          Pointez en arrivant sur le chantier et en repartant : le gérant voit et valide vos journées.
        </p>

        <div className="space-y-3 border-t border-leaf-100 pt-3">
          <PhotoUpload
            photos={photosBefore}
            onChange={(p) => savePhotos(p, photosAfter)}
            label="Photos avant le chantier (4 max)"
            maxPhotos={4}
          />
          <PhotoUpload
            photos={photosAfter}
            onChange={(p) => savePhotos(photosBefore, p)}
            label="Photos après le chantier (4 max)"
            maxPhotos={4}
          />
          <p className="text-xs text-leaf-800/50">
            Enregistrées automatiquement — le gérant les voit dans sa gestion terrain.
            {photosSaved && <span className="ml-2 font-semibold text-leaf-700">✓ Enregistré</span>}
          </p>
        </div>
      </section>

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

      <div className="sticky bottom-4 mt-4 flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer mes disponibilités"}
        </button>
        {saved && <span className="text-sm font-semibold text-leaf-700">✓ Enregistré</span>}
      </div>

      {/* Agenda de l'entreprise (le même que côté gérant, sans les téléphones) */}
      <section className="mt-8 border-t border-leaf-100 pt-6">
        <AgendaView endpoint="/api/pro/planning" loginPath="/pro/login" />
      </section>
    </main>
  );
}
