"use client";

// Pointage : arrivée/départ du jour (rattrapage 7 jours) + photos avant/après.
import { useEffect, useState } from "react";
import PhotoUpload from "@/components/PhotoUpload";
import { ymd } from "../shared";

export default function ProPointagePage() {
  const [pointage, setPointage] = useState<{ arrival: string; departure: string; validated: boolean } | null>(null);
  const [pointing, setPointing] = useState(false);
  const [pointDate, setPointDate] = useState(() => ymd(new Date()));
  const [photosBefore, setPhotosBefore] = useState<string[]>([]);
  const [photosAfter, setPhotosAfter] = useState<string[]>([]);
  const [photosSaved, setPhotosSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/pro/pointage?date=${pointDate}`)
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/pro/login";
          throw new Error("unauthorized");
        }
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        if (!data) return;
        setPointage(data);
        setPhotosBefore(data.photosBefore ?? []);
        setPhotosAfter(data.photosAfter ?? []);
      })
      .catch(() => {});
  }, [pointDate]);

  async function savePhotos(before: string[], after: string[]) {
    setPhotosBefore(before);
    setPhotosAfter(after);
    try {
      const res = await fetch("/api/pro/pointage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photosBefore: before, photosAfter: after, date: pointDate }),
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
        body: JSON.stringify({ action, date: pointDate }),
      });
      const data = await res.json();
      if (res.ok) setPointage((p) => ({ arrival: data.arrival, departure: data.departure, validated: p?.validated ?? false }));
    } finally {
      setPointing(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-4 text-xl font-bold">Pointage</h1>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Ma journée</h2>
          {pointage?.validated && (
            <span className="rounded-full bg-leaf-100 px-2.5 py-0.5 text-[11px] font-semibold text-leaf-800">
              Validée par le gérant
            </span>
          )}
        </div>
        <div>
          <label className="label" htmlFor="p-date">Jour</label>
          <input
            id="p-date"
            className="input"
            type="date"
            max={ymd(new Date())}
            min={ymd(new Date(Date.now() - 7 * 86400_000))}
            value={pointDate}
            onChange={(e) => setPointDate(e.target.value)}
          />
          <p className="mt-1 text-xs text-leaf-800/60">
            Oubli ? Choisissez un jour passé (7 jours maximum) pour rattraper.
          </p>
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
          {pointDate !== ymd(new Date()) && " Sur un jour passé, l'heure enregistrée est l'heure actuelle — signalez toute correction au gérant."}
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
    </main>
  );
}
