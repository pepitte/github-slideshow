"use client";

// Congés et indisponibilités du paysagiste. Une absence déclarée bloque
// l'attribution automatique et apparaît dans l'agenda du gérant — contrairement
// à un jour simplement non coché.
import { useEffect, useState } from "react";

const MOTIFS: Record<string, string> = {
  conges: "Congés",
  arret: "Arrêt de travail",
  formation: "Formation",
  personnel: "Personnel",
};

type Absence = { id: string; du: string; au: string; motif: string; note: string };

function jourFr(j: string): string {
  return new Date(`${j}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function Absences() {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [motif, setMotif] = useState("conges");
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    fetch("/api/pro/absences")
      .then((r) => (r.ok ? r.json() : { absences: [] }))
      .then((d) => setAbsences(d.absences ?? []))
      .catch(() => {});
  }, []);

  async function ajouter() {
    setErreur("");
    const res = await fetch("/api/pro/absences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ du, au: au || du, motif }),
    });
    const d = await res.json();
    if (!res.ok) {
      setErreur(d.error ?? "Enregistrement impossible.");
      return;
    }
    setAbsences(d.absences ?? []);
    setOuvert(false);
    setDu("");
    setAu("");
  }

  async function retirer(a: Absence) {
    if (!window.confirm(`Retirer l'absence du ${jourFr(a.du)} au ${jourFr(a.au)} ?`)) return;
    const res = await fetch(`/api/pro/absences?id=${a.id}`, { method: "DELETE" });
    if (res.ok) {
      const d = await res.json();
      setAbsences(d.absences ?? []);
    }
  }

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const aVenir = absences.filter((a) => a.au >= aujourdhui);

  return (
    <section className="card mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Congés et absences</h2>
        {!ouvert && (
          <button className="btn-secondary !px-3 !py-1.5 text-sm" onClick={() => setOuvert(true)}>
            Déclarer
          </button>
        )}
      </div>
      <p className="text-sm text-leaf-800/70">
        Une absence déclarée bloque toute attribution sur la période, même les jours que vous
        aviez cochés. Le gérant la voit dans son agenda.
      </p>

      {ouvert && (
        <div className="rounded-xl border-2 border-leaf-300 bg-leaf-50/40 p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs text-leaf-800/60">
              Du
              <input
                className="input !py-1.5"
                type="date"
                value={du}
                onChange={(e) => setDu(e.target.value)}
              />
            </label>
            <label className="text-xs text-leaf-800/60">
              Au
              <input
                className="input !py-1.5"
                type="date"
                value={au}
                onChange={(e) => setAu(e.target.value)}
              />
            </label>
            <label className="text-xs text-leaf-800/60">
              Motif
              <select
                className="input !py-1.5"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
              >
                {Object.entries(MOTIFS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {erreur && <p className="mt-2 text-sm font-semibold text-red-600">{erreur}</p>}
          <div className="mt-3 flex gap-2">
            <button
              className="btn-primary !w-auto !px-4 !py-2 text-sm"
              onClick={ajouter}
              disabled={!du}
            >
              Enregistrer
            </button>
            <button
              className="btn-secondary !px-4 !py-2 text-sm"
              onClick={() => {
                setOuvert(false);
                setErreur("");
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {aVenir.length === 0 ? (
        <p className="text-sm text-leaf-800/50">Aucune absence déclarée.</p>
      ) : (
        <ul className="space-y-1">
          {aVenir.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-2 rounded-xl bg-sand-50 px-3 py-2 text-sm"
            >
              <span className="font-semibold">
                {a.du === a.au ? jourFr(a.du) : `Du ${jourFr(a.du)} au ${jourFr(a.au)}`}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-leaf-800/70">
                {MOTIFS[a.motif] ?? a.motif}
              </span>
              <button onClick={() => retirer(a)} className="ml-auto text-xs text-red-600 underline">
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
