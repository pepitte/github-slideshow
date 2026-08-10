"use client";

// Espace professionnel : statut de disponibilité, dates, nombre de jours, rayon.
import { useEffect, useMemo, useState } from "react";
import { PRO_STATUS_META, PRO_STATUS_ORDER } from "@/lib/proStatus";
import AgendaView from "@/components/AgendaView";
import PhotoUpload from "@/components/PhotoUpload";

type Mission = {
  id: string;
  day: string;
  startAt: string;
  endAt: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  projectType: string;
  description: string;
};
type EquipeJour = { id: string; day: string; city: string; proName: string };

const PROJET_LABELS: Record<string, string> = {
  entretien: "Entretien de jardin",
  taille_haie: "Taille de haie",
  debroussaillage: "Débroussaillage",
  contrat_annuel: "Contrat d'entretien",
  autre: "Autre projet",
};

function heureParis(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })
    .replace(":", "h");
}
function labelJour(day: string, today: string): string {
  if (day === today) return "Aujourd'hui";
  const date = new Date(`${day}T12:00:00`);
  const demain = new Date(`${today}T12:00:00`);
  demain.setDate(demain.getDate() + 1);
  const label = date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  if (day === `${demain.getFullYear()}-${String(demain.getMonth() + 1).padStart(2, "0")}-${String(demain.getDate()).padStart(2, "0")}`) {
    return `Demain — ${label}`;
  }
  return label.charAt(0).toUpperCase() + label.slice(1);
}
function heuresLabel(minutes: number): string {
  return `${Math.floor(minutes / 60)}h${minutes % 60 ? String(minutes % 60).padStart(2, "0") : ""}`;
}

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
  const [pointDate, setPointDate] = useState(() => ymd(new Date()));
  const [photosBefore, setPhotosBefore] = useState<string[]>([]);
  const [photosAfter, setPhotosAfter] = useState<string[]>([]);
  const [photosSaved, setPhotosSaved] = useState(false);
  // Mes chantiers attribués + activité de l'équipe + heures pointées
  const [missions, setMissions] = useState<Mission[]>([]);
  const [equipe, setEquipe] = useState<EquipeJour[]>([]);
  const [heures, setHeures] = useState<{ semaine: number; mois: number } | null>(null);
  const [vueSemaine, setVueSemaine] = useState(false);
  const [declineMsg, setDeclineMsg] = useState("");

  function loadMissions() {
    fetch("/api/pro/missions")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setMissions(data.miens ?? []);
        setEquipe(data.equipe ?? []);
        setHeures(data.heures ?? null);
      })
      .catch(() => {});
  }
  useEffect(loadMissions, []);

  async function decline(m: Mission) {
    if (
      !window.confirm(
        `Vous ne pouvez pas assurer le chantier du ${labelJour(m.day, ymd(new Date())).toLowerCase()} ?\nIl sera proposé à un autre professionnel et le gérant sera prévenu.`
      )
    )
      return;
    const res = await fetch("/api/pro/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, action: "decline" }),
    });
    const data = await res.json();
    setDeclineMsg(data.message ?? (res.ok ? "Désistement enregistré." : "Action impossible."));
    loadMissions();
    setTimeout(() => setDeclineMsg(""), 8000);
  }

  useEffect(() => {
    fetch(`/api/pro/pointage?date=${pointDate}`)
      .then((r) => (r.ok ? r.json() : null))
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

      {declineMsg && (
        <p className="mb-4 rounded-xl bg-leaf-50 px-4 py-3 text-sm font-medium text-leaf-800">{declineMsg}</p>
      )}

      {/* Prochain chantier attribué : l'essentiel en grand, itinéraire + appel */}
      {missions.length > 0 && (
        <section className="card mb-4 space-y-3 border-2 border-leaf-600/30">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Mon prochain chantier</h2>
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-800">
              Attribué à vous
            </span>
          </div>
          <p className="text-lg font-bold text-leaf-900">
            {labelJour(missions[0].day, ymd(new Date()))}
            <span className="ml-2 text-base font-semibold text-leaf-800/70">
              {heureParis(missions[0].startAt)} – {heureParis(missions[0].endAt)}
            </span>
          </p>
          <div className="text-sm">
            <p className="font-semibold">
              {missions[0].firstName} {missions[0].lastName}
              <span className="ml-2 font-normal text-leaf-800/70">
                {PROJET_LABELS[missions[0].projectType] ?? missions[0].projectType}
              </span>
            </p>
            <p className="text-leaf-800/80">
              {missions[0].address}, {missions[0].postalCode} {missions[0].city}
            </p>
            {missions[0].description && (
              <p className="mt-1 rounded-xl bg-sand-50 p-3 text-leaf-800/80">{missions[0].description}</p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              className="btn-primary flex-1 text-center"
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                `${missions[0].address}, ${missions[0].postalCode} ${missions[0].city}`
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              Itinéraire
            </a>
            {missions[0].phone && (
              <a className="btn-secondary flex-1 text-center" href={`tel:${missions[0].phone}`}>
                Appeler le client
              </a>
            )}
          </div>
          <button onClick={() => decline(missions[0])} className="text-xs text-red-600 underline">
            Je ne peux pas assurer ce chantier
          </button>
        </section>
      )}

      {/* Les prochains jours : mes chantiers en avant, l'équipe en gris */}
      <section className="card mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Mes prochains jours</h2>
          <button
            onClick={() => setVueSemaine((v) => !v)}
            className="text-xs font-semibold text-leaf-700 underline"
          >
            {vueSemaine ? "Vue liste" : "Vue semaine"}
          </button>
        </div>
        {vueSemaine ? (
          <AgendaView endpoint="/api/pro/planning" loginPath="/pro/login" />
        ) : missions.length === 0 && equipe.length === 0 ? (
          <p className="py-4 text-center text-sm text-leaf-800/60">
            Aucun chantier à venir pour le moment. Pensez à cocher vos dates disponibles plus bas :
            les chantiers réservés dans votre secteur vous seront attribués automatiquement.
          </p>
        ) : (
          <div className="space-y-2">
            {Array.from(
              new Set([...missions.map((m) => m.day), ...equipe.map((e) => e.day)])
            )
              .sort()
              .slice(0, 14)
              .map((day) => {
                const miens = missions.filter((m) => m.day === day);
                const autres = equipe.filter((e) => e.day === day);
                return (
                  <div key={day}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-leaf-800/50">
                      {labelJour(day, ymd(new Date()))}
                    </p>
                    {miens.map((m) => (
                      <div
                        key={m.id}
                        className="mb-1 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm"
                      >
                        <p className="font-semibold text-green-900">
                          {heureParis(m.startAt)} – {heureParis(m.endAt)} · {m.firstName} {m.lastName}
                        </p>
                        <p className="text-green-800/80">
                          {m.address}, {m.city} · {PROJET_LABELS[m.projectType] ?? m.projectType}
                        </p>
                        <div className="mt-1 flex gap-3 text-xs font-semibold">
                          <a
                            className="text-green-900 underline"
                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                              `${m.address}, ${m.postalCode} ${m.city}`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Itinéraire
                          </a>
                          {m.phone && (
                            <a className="text-green-900 underline" href={`tel:${m.phone}`}>
                              {m.phone}
                            </a>
                          )}
                          <button onClick={() => decline(m)} className="text-red-600 underline">
                            Je ne peux pas
                          </button>
                        </div>
                      </div>
                    ))}
                    {autres.map((e) => (
                      <div
                        key={e.id}
                        className="mb-1 rounded-xl bg-sand-50 px-3 py-1.5 text-xs text-leaf-800/60"
                      >
                        Chantier à {e.city || "?"} — {e.proName}
                      </div>
                    ))}
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {/* Heures pointées */}
      {heures && (
        <section className="card mb-4">
          <h2 className="mb-2 font-bold">Mes heures pointées</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-sand-50 px-3 py-2 text-center">
              <p className="text-xs text-leaf-800/60">Cette semaine</p>
              <p className="text-lg font-bold">{heures.semaine ? heuresLabel(heures.semaine) : "—"}</p>
            </div>
            <div className="rounded-xl bg-sand-50 px-3 py-2 text-center">
              <p className="text-xs text-leaf-800/60">Ce mois-ci</p>
              <p className="text-lg font-bold">{heures.mois ? heuresLabel(heures.mois) : "—"}</p>
            </div>
          </div>
        </section>
      )}

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
