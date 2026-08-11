"use client";

// « Affaires / Projets » : le pipeline commercial. Seuls les dossiers réellement
// engagés y figurent — les simples contacts restent dans « Tous les clients ».
import { useEffect, useState } from "react";
import { ETAPES, ETAPE_PAR_ID, COULEURS_GROUPE, MOTIFS_PERTE, type Groupe } from "@/lib/pipeline";
import FicheAffaire from "./FicheAffaire";

export type Affaire = {
  id: string;
  intitule: string;
  statut: string;
  motifPerte: string;
  montant: number | null;
  prochaineActionAt: string | null;
  city: string;
  postalCode: string;
  groupe: Groupe;
  rdvCount: number;
  documentsCount: number;
  contact: { id: string; firstName: string; lastName: string; phone: string; email: string };
  agence: { id: string; nom: string; couleur: string } | null;
  pro: { id: string; name: string } | null;
};

type AgenceLite = { id: string; nom: string; couleur: string };

const BANDES: { groupe: Groupe; titre: string; aide: string }[] = [
  { groupe: "commercial", titre: "Commercial", aide: "à traiter, relancer, chiffrer" },
  { groupe: "execution", titre: "Exécution", aide: "gagnées, chantier à mener" },
];

function euros(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function jour(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Une action due aujourd'hui ou en retard doit sauter aux yeux. */
function enRetard(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() <= Date.now();
}

export default function AdminAffairesPage() {
  const [affaires, setAffaires] = useState<Affaire[]>([]);
  const [compteurs, setCompteurs] = useState<Record<string, number>>({});
  const [agences, setAgences] = useState<AgenceLite[]>([]);
  const [vue, setVue] = useState<"actives" | "toutes">("actives");
  const [q, setQ] = useState("");
  const [agence, setAgence] = useState("");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [reprise, setReprise] = useState("");
  const [repriseEnCours, setRepriseEnCours] = useState(false);

  function charger() {
    const p = new URLSearchParams({ vue });
    if (q.trim()) p.set("q", q.trim());
    if (agence) p.set("agence", agence);
    fetch(`/api/admin/affaires?${p.toString()}`)
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/admin/login";
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then((d) => {
        setAffaires(d.affaires ?? []);
        setCompteurs(d.compteurs ?? {});
      })
      .catch(() => {})
      .finally(() => setChargement(false));
  }

  useEffect(() => {
    fetch("/api/admin/agences")
      .then((r) => (r.ok ? r.json() : { agences: [] }))
      .then((d) => setAgences(d.agences ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(charger, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vue, q, agence]);

  async function lancerReprise() {
    if (
      !window.confirm(
        "Créer les affaires à partir des rendez-vous existants ?\nL'opération peut être relancée sans risque."
      )
    )
      return;
    setRepriseEnCours(true);
    const res = await fetch("/api/admin/affaires/reprise", { method: "POST" });
    const d = await res.json();
    setRepriseEnCours(false);
    setReprise(d.message ?? d.error ?? "Reprise impossible.");
    charger();
  }

  /** Déplacer une affaire d'une étape à l'autre. */
  async function changerEtape(a: Affaire, statut: string) {
    let motifPerte = a.motifPerte;
    if (statut === "perdu" && !MOTIFS_PERTE[motifPerte]) {
      const choix = window.prompt(
        "Pourquoi cette affaire est-elle perdue ?\n" +
          Object.entries(MOTIFS_PERTE)
            .map(([id, l], i) => `${i + 1}. ${l}`)
            .join("\n") +
          "\n\nTapez le numéro :",
        "3"
      );
      const cles = Object.keys(MOTIFS_PERTE);
      const idx = Number(choix) - 1;
      if (!(idx >= 0 && idx < cles.length)) return;
      motifPerte = cles[idx];
    }
    const res = await fetch(`/api/admin/affaires/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut, motifPerte }),
    });
    if (res.ok) charger();
  }

  const aRelancer = affaires.filter((a) => enRetard(a.prochaineActionAt));

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Affaires ({affaires.length})</h1>
          <p className="text-sm text-leaf-800/60">
            Les demandes réellement engagées. Les autres restent dans « Tous les clients ».
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-secondary !px-3 !py-2 text-sm"
            onClick={lancerReprise}
            disabled={repriseEnCours}
          >
            {repriseEnCours ? "Reprise…" : "Reprendre l'existant"}
          </button>
        </div>
      </div>

      {reprise && (
        <p className="mb-3 rounded-xl bg-leaf-50 px-4 py-3 text-sm font-medium text-leaf-800">{reprise}</p>
      )}

      {aRelancer.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm font-bold text-amber-900">
            {aRelancer.length} affaire(s) à relancer aujourd&apos;hui
          </p>
          <p className="mt-0.5 text-sm text-amber-900/80">
            {aRelancer
              .slice(0, 4)
              .map((a) => `${a.contact.firstName} ${a.contact.lastName}`.trim() || a.intitule)
              .join(" · ")}
            {aRelancer.length > 4 ? ` +${aRelancer.length - 4}` : ""}
          </p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="input flex-1 !w-auto"
          placeholder="Rechercher : client, ville, intitulé…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex rounded-xl bg-leaf-50 p-1">
          {(["actives", "toutes"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVue(v)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                vue === v ? "bg-white shadow-sm" : "text-leaf-800/60"
              }`}
            >
              {v === "actives" ? "En cours" : "Toutes"}
            </button>
          ))}
        </div>
        {agences.length > 0 && (
          <select className="input !w-auto" value={agence} onChange={(e) => setAgence(e.target.value)}>
            <option value="">Tous secteurs</option>
            {agences.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nom}
              </option>
            ))}
          </select>
        )}
      </div>

      {chargement && <p className="py-8 text-center text-leaf-800/60">Chargement…</p>}

      {!chargement && affaires.length === 0 && (
        <div className="card py-8 text-center text-sm text-leaf-800/60">
          {q || agence ? (
            "Aucune affaire ne correspond."
          ) : (
            <>
              Aucune affaire. Si vous aviez déjà des rendez-vous, cliquez sur{" "}
              <b>Reprendre l&apos;existant</b> pour les transformer en affaires.
            </>
          )}
        </div>
      )}

      {/* Pipeline : une colonne par étape, groupées en bandes */}
      <div className="space-y-6">
        {BANDES.map((bande) => {
          const etapes = ETAPES.filter((e) => e.groupe === bande.groupe);
          const dansLaBande = affaires.filter((a) => a.groupe === bande.groupe);
          if (vue === "actives" && dansLaBande.length === 0 && !chargement) return null;
          return (
            <section key={bande.groupe}>
              <div className="mb-2 flex items-baseline gap-2">
                <h2
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: COULEURS_GROUPE[bande.groupe].puce }}
                >
                  {bande.titre}
                </h2>
                <span className="text-xs text-leaf-800/50">{bande.aide}</span>
                <span className="ml-auto text-xs font-semibold text-leaf-800/60">
                  {dansLaBande.length}
                </span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {etapes.map((etape) => {
                  const liste = dansLaBande.filter((a) => a.statut === etape.id);
                  return (
                    <div key={etape.id} className="w-64 shrink-0">
                      <div className="mb-1.5 flex items-baseline justify-between gap-2 px-0.5">
                        <span className="text-sm font-bold">{etape.court}</span>
                        <span className="text-xs text-leaf-800/50">
                          {compteurs[etape.id] ?? 0}
                        </span>
                      </div>
                      <p className="mb-1.5 px-0.5 text-[11px] leading-tight text-leaf-800/50">
                        {etape.aide}
                      </p>
                      <div className="space-y-1.5">
                        {liste.map((a) => (
                          <div key={a.id} className="card !p-2.5">
                            <button
                              className="w-full text-left"
                              onClick={() => setOuvert(ouvert === a.id ? null : a.id)}
                            >
                              <p className="text-sm font-semibold">
                                {`${a.contact.firstName} ${a.contact.lastName}`.trim() || "Sans nom"}
                              </p>
                              <p className="text-xs text-leaf-800/70">{a.intitule}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                                {a.montant !== null && (
                                  <span className="font-semibold text-leaf-800">{euros(a.montant)}</span>
                                )}
                                {a.agence && (
                                  <span
                                    className="rounded-full px-1.5 py-0.5 font-semibold text-white"
                                    style={{ background: a.agence.couleur }}
                                  >
                                    {a.agence.nom}
                                  </span>
                                )}
                                {a.prochaineActionAt && (
                                  <span
                                    className={`rounded-full px-1.5 py-0.5 font-semibold ${
                                      enRetard(a.prochaineActionAt)
                                        ? "bg-amber-200 text-amber-900"
                                        : "bg-sand-50 text-leaf-800/70"
                                    }`}
                                  >
                                    {enRetard(a.prochaineActionAt) ? "À relancer " : "Suivi "}
                                    {jour(a.prochaineActionAt)}
                                  </span>
                                )}
                              </div>
                            </button>
                            <select
                              className="input mt-1.5 !py-1 text-xs"
                              value={a.statut}
                              onChange={(e) => changerEtape(a, e.target.value)}
                            >
                              {ETAPES.map((e) => (
                                <option key={e.id} value={e.id}>
                                  {e.label}
                                </option>
                              ))}
                            </select>
                            {ouvert === a.id && (
                              <FicheAffaire id={a.id} onChange={charger} />
                            )}
                          </div>
                        ))}
                        {liste.length === 0 && (
                          <p className="rounded-xl border border-dashed border-leaf-200 py-3 text-center text-[11px] text-leaf-800/40">
                            vide
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {vue === "toutes" && (
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-leaf-800/60">
              Clôturées
            </h2>
            <div className="space-y-1.5">
              {affaires
                .filter((a) => a.groupe.startsWith("clos"))
                .map((a) => (
                  <div key={a.id} className="card !p-2.5">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold">
                        {`${a.contact.firstName} ${a.contact.lastName}`.trim() || "Sans nom"}
                      </span>
                      <span className="text-leaf-800/60">{a.intitule}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          COULEURS_GROUPE[a.groupe].badge
                        }`}
                      >
                        {ETAPE_PAR_ID[a.statut]?.label}
                        {a.motifPerte ? ` — ${MOTIFS_PERTE[a.motifPerte]}` : ""}
                      </span>
                      <span className="ml-auto font-semibold">{euros(a.montant)}</span>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
