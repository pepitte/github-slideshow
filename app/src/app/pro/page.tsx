"use client";

// Tableau de bord du professionnel : tuiles de synthèse, prochain chantier,
// aperçu des jours à venir. Le détail vit dans les sections de la barre latérale.
import { useEffect, useState } from "react";
import Link from "next/link";
import { PRO_STATUS_META } from "@/lib/proStatus";
import {
  type Mission,
  type EquipeJour,
  PROJET_LABELS,
  ymd,
  heureParis,
  labelJour,
  heuresLabel,
  itineraireUrl,
  confirmDecline,
} from "./shared";

export default function ProDashboard() {
  const [pro, setPro] = useState<{ name: string; status: string } | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [equipe, setEquipe] = useState<EquipeJour[]>([]);
  const [heures, setHeures] = useState<{ semaine: number; mois: number } | null>(null);
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

  useEffect(() => {
    fetch("/api/pro/me")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/pro/login";
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then(({ pro }) => setPro({ name: pro.name, status: pro.status }))
      .catch(() => {});
    loadMissions();
  }, []);

  async function decline(m: Mission) {
    if (!confirmDecline(m, ymd(new Date()))) return;
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

  if (!pro) {
    return <main className="mx-auto max-w-lg px-4 py-10 text-center text-leaf-800/60">Chargement…</main>;
  }

  const statut = PRO_STATUS_META[pro.status] ?? PRO_STATUS_META.indisponible;
  const prochain = missions[0];
  const apercu = Array.from(new Set([...missions.map((m) => m.day), ...equipe.map((e) => e.day)]))
    .sort()
    .slice(0, 5);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-wide text-leaf-800/50">Tableau de bord</p>
        <h1 className="text-lg font-bold">Bonjour {pro.name}</h1>
      </div>

      {declineMsg && (
        <p className="mb-4 rounded-xl bg-leaf-50 px-4 py-3 text-sm font-medium text-leaf-800">{declineMsg}</p>
      )}

      {/* Tuiles de synthèse, toujours visibles même à zéro */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Link href="/pro/chantiers" className="card !p-3 text-center transition hover:bg-leaf-50">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-leaf-800/50">
            RDV à venir
          </p>
          <p className="text-2xl font-bold text-leaf-900">{missions.length}</p>
          <p className="text-[11px] text-leaf-800/60">
            {prochain ? `prochain : ${labelJour(prochain.day, ymd(new Date())).toLowerCase()}` : "attribués à vous"}
          </p>
        </Link>
        <Link href="/pro/pointage" className="card !p-3 text-center transition hover:bg-leaf-50">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-leaf-800/50">
            Heures semaine
          </p>
          <p className="text-2xl font-bold text-leaf-900">
            {heures?.semaine ? heuresLabel(heures.semaine) : "0h"}
          </p>
          <p className="text-[11px] text-leaf-800/60">
            {heures?.mois ? `${heuresLabel(heures.mois)} ce mois-ci` : "pointées"}
          </p>
        </Link>
        <Link href="/pro/disponibilites" className="card !p-3 text-center transition hover:bg-leaf-50">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-leaf-800/50">Statut</p>
          <p className="mx-auto mt-1.5 h-5 w-5 rounded-full" style={{ background: statut.dot }} />
          <p className="mt-1 text-[11px] font-semibold text-leaf-800/80">
            {statut.label.replace("Disponible pour un ", "").replace("Disponible sous ", "Sous ")}
          </p>
        </Link>
      </div>

      {/* Prochain RDV : l'essentiel en grand */}
      {prochain ? (
        <section
          className={`card mb-4 space-y-3 border-2 ${
            prochain.kind === "devis" ? "border-blue-600/30" : "border-leaf-600/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-bold">
              {prochain.kind === "devis" ? "Ma prochaine visite devis" : "Mon prochain chantier"}
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                prochain.kind === "devis" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
              }`}
            >
              {prochain.kind === "devis" ? "Visite devis" : "Attribué à vous"}
            </span>
          </div>
          <p className="text-lg font-bold text-leaf-900">
            {labelJour(prochain.day, ymd(new Date()))}
            <span className="ml-2 text-base font-semibold text-leaf-800/70">
              {heureParis(prochain.startAt)} – {heureParis(prochain.endAt)}
            </span>
          </p>
          <div className="text-sm">
            <p className="font-semibold">
              {prochain.firstName} {prochain.lastName}
              <span className="ml-2 font-normal text-leaf-800/70">
                {PROJET_LABELS[prochain.projectType] ?? prochain.projectType}
              </span>
            </p>
            <p className="text-leaf-800/80">
              {prochain.address}, {prochain.postalCode} {prochain.city}
            </p>
            {prochain.description && (
              <p className="mt-1 rounded-xl bg-sand-50 p-3 text-leaf-800/80">{prochain.description}</p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a className="btn-primary flex-1 text-center" href={itineraireUrl(prochain)} target="_blank" rel="noreferrer">
              Itinéraire
            </a>
            {prochain.phone && (
              <a className="btn-secondary flex-1 text-center" href={`tel:${prochain.phone}`}>
                Appeler le client
              </a>
            )}
          </div>
          <button onClick={() => decline(prochain)} className="text-xs text-red-600 underline">
            {prochain.kind === "devis"
              ? "Je ne peux pas assurer cette visite"
              : "Je ne peux pas assurer ce chantier"}
          </button>
        </section>
      ) : (
        <section className="card mb-4 py-6 text-center text-sm text-leaf-800/60">
          Aucun chantier attribué pour le moment.
          <br />
          <Link href="/pro/disponibilites" className="font-semibold text-leaf-700 underline">
            Cochez vos dates disponibles
          </Link>{" "}
          : les chantiers réservés dans votre secteur vous seront attribués automatiquement.
        </section>
      )}

      {/* Aperçu des jours à venir */}
      {apercu.length > 0 && (
        <section className="card space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Les prochains jours</h2>
            <Link href="/pro/chantiers" className="text-xs font-semibold text-leaf-700 underline">
              Tout voir
            </Link>
          </div>
          {apercu.map((day) => {
            const miens = missions.filter((m) => m.day === day);
            const autres = equipe.filter((e) => e.day === day);
            return (
              <div key={day} className="text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-leaf-800/50">
                  {labelJour(day, ymd(new Date()))}
                </p>
                {miens.map((m) => (
                  <p
                    key={m.id}
                    className={`rounded-lg px-2 py-1 font-medium ${
                      m.kind === "devis" ? "bg-blue-50 text-blue-900" : "bg-green-50 text-green-900"
                    }`}
                  >
                    {m.kind === "devis" && `${heureParis(m.startAt)} · Visite devis · `}
                    {m.firstName} {m.lastName} — {m.city}
                  </p>
                ))}
                {autres.map((e) => (
                  <p key={e.id} className="px-2 py-0.5 text-xs text-leaf-800/50">
                    {e.kind === "devis" ? "Visite devis" : "Chantier"} à {e.city || "?"} — {e.proName}
                  </p>
                ))}
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
