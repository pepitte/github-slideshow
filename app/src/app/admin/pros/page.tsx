"use client";

// Vue gérant : tous les professionnels et leurs disponibilités déclarées.
import { useEffect, useState } from "react";
import { dispoResume, parseDispo } from "@/lib/proStatus";

type Pro = {
  id: string;
  name: string;
  email: string;
  phone: string;
  baseAddress: string;
  baseCity: string;
  basePostalCode: string;
  radiusKm: number;
  availableDays: number;
  datesJson: string;
  devisDispoJson: string;
  note: string;
  updatedAt: string;
};

function jourCourt(d: string): string {
  return new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function fmtJours(days: string[]): string {
  if (!days.length) return "—";
  return days.slice(0, 8).map(jourCourt).join(", ") + (days.length > 8 ? `… (+${days.length - 8})` : "");
}

/** « 13 août : 10h00 · 17h00 » pour chaque jour renseigné. */
function fmtCreneaux(json: string, days: string[]): string {
  const dispo = parseDispo(json);
  if (!days.length) return "—";
  return days
    .slice(0, 4)
    .map((d) => `${jourCourt(d)} : ${dispo[d].map((t) => t.replace(":", "h")).join(" · ")}`)
    .join(" | ") + (days.length > 4 ? `… (+${days.length - 4} jour(s))` : "");
}

export default function AdminProsPage() {
  const [pros, setPros] = useState<Pro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function removePro(p: Pro) {
    if (!window.confirm(`Retirer ${p.name} de la liste ? Ses pointages seront également supprimés.`)) return;
    setError("");
    const res = await fetch(`/api/admin/pros/${p.id}`, { method: "DELETE" });
    if (res.ok) setPros((list) => list.filter((x) => x.id !== p.id));
    else setError("Suppression impossible, réessayez.");
  }

  useEffect(() => {
    fetch("/api/admin/pros")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/admin/login";
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then((data) => setPros(data.pros ?? []))
      .finally(() => setLoading(false));
  }, []);

  // « Disponible » = a réellement coché quelque chose à venir dans son agenda.
  const today = new Date().toISOString().slice(0, 10);
  const available = pros.filter((p) => dispoResume(p, today).actif);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Professionnels ({pros.length})</h1>
        <span className="text-sm text-leaf-800/60">{available.length} disponible(s)</span>
      </div>

      {error && <p className="mb-3 text-sm font-semibold text-red-600">{error}</p>}
      {loading && <p className="py-8 text-center text-leaf-800/60">Chargement…</p>}
      {!loading && pros.length === 0 && (
        <p className="card py-8 text-center text-leaf-800/60">
          Aucun professionnel inscrit. Partagez le lien <b>/pro</b> à votre équipe.
        </p>
      )}

      <div className="space-y-3">
        {pros.map((p) => {
          const resume = dispoResume(p, today);
          return (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-sm text-leaf-800/70">
                    {[p.baseAddress, `${p.basePostalCode} ${p.baseCity}`.trim()]
                      .filter(Boolean)
                      .join(", ")}
                    {p.baseAddress || p.baseCity || p.basePostalCode ? " · " : ""}
                    rayon {p.radiusKm} km
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${resume.badge}`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: resume.dot }} />
                    {resume.label}
                  </span>
                  <button
                    onClick={() => removePro(p)}
                    className="text-xs text-red-600 underline hover:text-red-700"
                  >
                    Retirer
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-1 border-t border-leaf-100 pt-3 text-sm">
                <p>
                  <a className="text-leaf-700 underline" href={`tel:${p.phone}`}>{p.phone || "—"}</a>
                  {" · "}
                  <a className="text-leaf-700 underline" href={`mailto:${p.email}`}>{p.email}</a>
                </p>
                <p className="text-leaf-800/70">{resume.detail}</p>
                <p>Jours de chantier : {fmtJours(resume.jours)}</p>
                <p>Créneaux de visite : {fmtCreneaux(p.devisDispoJson, resume.joursDevis)}</p>
                {p.note && <p className="rounded-xl bg-sand-50 p-3 text-leaf-800/80">{p.note}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
