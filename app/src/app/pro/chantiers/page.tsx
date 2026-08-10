"use client";

// Mes chantiers : la liste des jours à venir (les miens en vert, l'équipe en
// gris), avec bascule vers la vue semaine (agenda complet de l'entreprise).
import { useEffect, useState } from "react";
import AgendaView from "@/components/AgendaView";
import {
  type Mission,
  type EquipeJour,
  PROJET_LABELS,
  ymd,
  heureParis,
  labelJour,
  itineraireUrl,
  confirmDecline,
} from "../shared";

export default function ProChantiersPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [equipe, setEquipe] = useState<EquipeJour[]>([]);
  const [vueSemaine, setVueSemaine] = useState(false);
  const [declineMsg, setDeclineMsg] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/pro/missions")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/pro/login";
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then((data) => {
        setMissions(data.miens ?? []);
        setEquipe(data.equipe ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function decline(m: Mission) {
    if (!confirmDecline(m, ymd(new Date()))) return;
    const res = await fetch("/api/pro/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, action: "decline" }),
    });
    const data = await res.json();
    setDeclineMsg(data.message ?? (res.ok ? "Désistement enregistré." : "Action impossible."));
    load();
    setTimeout(() => setDeclineMsg(""), 8000);
  }

  const jours = Array.from(new Set([...missions.map((m) => m.day), ...equipe.map((e) => e.day)]))
    .sort()
    .slice(0, 21);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Mes chantiers</h1>
          <p className="text-sm text-leaf-800/60">
            En vert : les vôtres. En gris : l&apos;activité de l&apos;équipe.
          </p>
        </div>
        <button
          onClick={() => setVueSemaine((v) => !v)}
          className="btn-secondary !px-3 !py-1.5 text-xs"
        >
          {vueSemaine ? "Vue liste" : "Vue semaine"}
        </button>
      </div>

      {declineMsg && (
        <p className="mb-4 rounded-xl bg-leaf-50 px-4 py-3 text-sm font-medium text-leaf-800">{declineMsg}</p>
      )}

      {vueSemaine ? (
        <AgendaView endpoint="/api/pro/planning" loginPath="/pro/login" />
      ) : loading ? (
        <p className="py-8 text-center text-leaf-800/60">Chargement…</p>
      ) : jours.length === 0 ? (
        <p className="card py-8 text-center text-sm text-leaf-800/60">
          Aucun chantier à venir pour le moment. Pensez à cocher vos dates disponibles
          (section Disponibilités) : les chantiers réservés dans votre secteur vous seront
          attribués automatiquement.
        </p>
      ) : (
        <div className="space-y-3">
          {jours.map((day) => {
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
                    {m.description && (
                      <p className="mt-1 rounded-lg bg-white/60 p-2 text-xs text-green-900/80">{m.description}</p>
                    )}
                    <div className="mt-1 flex gap-3 text-xs font-semibold">
                      <a
                        className="text-green-900 underline"
                        href={itineraireUrl(m)}
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
    </main>
  );
}
