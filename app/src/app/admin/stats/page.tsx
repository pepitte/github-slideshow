"use client";

// Statistiques du gérant : volume de rendez-vous, taux de transformation
// des devis et chiffre d'affaires facturé.
import { useEffect, useMemo, useRef, useState } from "react";
import { euros } from "@/lib/documents";

type Week = { week: string; devis: number; chantier: number; total: number };
type Month = { month: string; facture: number; encaisse: number };
type Stats = {
  weeks: Week[];
  months: Month[];
  statuses: Record<string, number>;
  crm: {
    contacts: number;
    affaires: number;
    actives: number;
    gagnees: number;
    perdues: number;
    taux: number | null;
    pipelineMontant: number;
  };
  totals: {
    bookings: number;
    upcoming: number;
    winRate: number | null;
    decided: number;
    devisEnvoyes: number;
    devisAcceptes: number;
    caMois: number;
    caAnnee: number;
    resteAEncaisser: number;
  };
};

// Bleu = devis, vert = chantier : même code couleur que l'agenda et les pros.
const DEVIS = "#2563eb";
const CHANTIER = "#16a34a";

const STATUS_META: [string, string, string][] = [
  ["a_faire", "À faire", "#f59e0b"],
  ["devis_envoye", "Devis envoyé", "#2563eb"],
  ["gagne", "Gagné", "#16a34a"],
  ["perdu", "Perdu", "#dc2626"],
  ["annule", "Annulé", "#94a3b8"],
];

const shortDay = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const shortMonth = (ym: string) =>
  new Date(`${ym}-01T12:00:00`).toLocaleDateString("fr-FR", { month: "short" });

/** Tuile chiffre-clé : la donnée principale, sans graphique. */
function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-leaf-800/50">{label}</p>
      <p className="mt-1 text-2xl font-bold text-leaf-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-leaf-800/60">{hint}</p>}
    </div>
  );
}

export default function AdminStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);
  // Sur petit écran, les graphiques défilent : on montre d'emblée la période récente.
  const weekScroll = useRef<HTMLDivElement>(null);
  const monthScroll = useRef<HTMLDivElement>(null);

  useEffect(() => {
    for (const el of [weekScroll.current, monthScroll.current]) {
      if (el) el.scrollLeft = el.scrollWidth;
    }
  }, [stats]);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/admin/login";
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const maxWeek = useMemo(
    () => Math.max(1, ...(stats?.weeks ?? []).map((w) => w.total)),
    [stats]
  );
  const maxMonth = useMemo(
    () => Math.max(1, ...(stats?.months ?? []).map((m) => m.facture)),
    [stats]
  );
  const maxStatus = useMemo(
    () => Math.max(1, ...Object.values(stats?.statuses ?? {})),
    [stats]
  );

  if (loading) return <main className="px-4 py-10 text-center text-leaf-800/60">Chargement…</main>;
  if (!stats) return <main className="px-4 py-10 text-center text-leaf-800/60">Statistiques indisponibles.</main>;

  const { totals } = stats;
  const busiest = stats.weeks.reduce((a, b) => (b.total >= a.total ? b : a), stats.weeks[0]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-xl font-bold">Statistiques</h1>
      <p className="mb-5 text-sm text-leaf-800/60">Activité des 12 dernières semaines et facturation de l&apos;année.</p>

      {/* Entonnoir : ce qui entre, ce qui devient un projet, ce qui se signe */}
      {stats.crm.affaires > 0 && (
        <section className="card mb-6">
          <h2 className="mb-1 font-bold">De la demande au chantier</h2>
          <p className="mb-3 text-sm text-leaf-800/60">
            Toutes les demandes reçues ne deviennent pas des projets — voici où elles vont.
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              label="Clients en base"
              value={String(stats.crm.contacts)}
              hint="Tous les contacts entrants"
            />
            <Tile
              label="Projets engagés"
              value={String(stats.crm.affaires)}
              hint={`${stats.crm.actives} encore en cours`}
            />
            <Tile
              label="Taux de transformation"
              value={stats.crm.taux === null ? "—" : `${stats.crm.taux} %`}
              hint={
                stats.crm.gagnees + stats.crm.perdues
                  ? `${stats.crm.gagnees} gagnées sur ${stats.crm.gagnees + stats.crm.perdues} décidées`
                  : "Aucune affaire encore décidée"
              }
            />
            <Tile
              label="En jeu"
              value={euros(stats.crm.pipelineMontant)}
              hint="Montant des affaires en cours"
            />
          </div>
        </section>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="RDV à venir"
          value={String(totals.upcoming)}
          hint={`${totals.bookings} rendez-vous au total`}
        />
        <Tile
          label="Devis gagnés"
          value={totals.winRate === null ? "—" : `${totals.winRate} %`}
          hint={
            totals.decided
              ? `${stats.statuses.gagne} gagnés sur ${totals.decided} décidés`
              : "Aucun devis encore gagné ou perdu"
          }
        />
        <Tile
          label="Facturé cette année"
          value={euros(totals.caAnnee)}
          hint={`dont ${euros(totals.caMois)} ce mois-ci`}
        />
        <Tile
          label="Reste à encaisser"
          value={euros(totals.resteAEncaisser)}
          hint="Factures non marquées payées"
        />
      </div>

      {/* Rendez-vous par semaine : deux types empilés, bleu = devis, vert = chantier */}
      <section className="card mb-6">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold">Rendez-vous par semaine</h2>
          <div className="flex items-center gap-3 text-xs text-leaf-800/70">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: DEVIS }} /> Devis
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CHANTIER }} /> Chantier
            </span>
          </div>
        </div>
        <p className="mb-4 text-xs text-leaf-800/60">
          Semaine la plus chargée : {shortDay(busiest.week)} ({busiest.total} rendez-vous). Les
          rendez-vous annulés ne sont pas comptés.
        </p>

        <p className="mb-1 text-[11px] text-leaf-800/50">Maximum : {maxWeek} rendez-vous</p>
        <div className="overflow-x-auto" ref={weekScroll}>
          <div className="flex min-w-[34rem] items-end gap-2 border-b border-leaf-100" style={{ height: 180 }}>
            {stats.weeks.map((w) => {
              const h = (w.total / maxWeek) * 150;
              const devisH = w.total ? (w.devis / w.total) * h : 0;
              const chantierH = w.total ? (w.chantier / w.total) * h : 0;
              return (
                <div key={w.week} className="flex flex-1 flex-col items-center justify-end gap-1">
                  {w.week === busiest.week && w.total > 0 && (
                    <span className="text-[11px] font-semibold text-leaf-800">{w.total}</span>
                  )}
                  <div
                    className="flex w-full flex-col justify-end"
                    style={{ height: h }}
                    title={`Semaine du ${shortDay(w.week)} : ${w.devis} devis, ${w.chantier} chantier(s)`}
                  >
                    {chantierH > 0 && (
                      <div
                        style={{ height: chantierH, background: CHANTIER }}
                        className="rounded-t-[4px]"
                      />
                    )}
                    {devisH > 0 && (
                      <div
                        style={{
                          height: devisH,
                          background: DEVIS,
                          marginTop: chantierH > 0 ? 2 : 0,
                        }}
                        className={chantierH > 0 ? "" : "rounded-t-[4px]"}
                      />
                    )}
                    {w.total === 0 && <div className="h-[2px] w-full rounded bg-leaf-100" />}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex min-w-[34rem] gap-2">
            {stats.weeks.map((w, i) => (
              <span key={w.week} className="flex-1 text-center text-[10px] text-leaf-800/50">
                {i % 2 === 0 || i === stats.weeks.length - 1 ? shortDay(w.week) : ""}
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={() => setShowTable((v) => !v)}
          className="mt-3 text-xs font-semibold text-leaf-700 underline"
        >
          {showTable ? "Masquer les chiffres" : "Voir les chiffres"}
        </button>
        {showTable && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[22rem] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-leaf-800/50">
                  <th className="py-1">Semaine du</th>
                  <th className="py-1">Devis</th>
                  <th className="py-1">Chantier</th>
                  <th className="py-1">Total</th>
                </tr>
              </thead>
              <tbody>
                {stats.weeks.map((w) => (
                  <tr key={w.week} className="border-t border-leaf-100">
                    <td className="py-1">{shortDay(w.week)}</td>
                    <td className="py-1">{w.devis}</td>
                    <td className="py-1">{w.chantier}</td>
                    <td className="py-1 font-semibold">{w.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Où en sont les rendez-vous : libellé toujours visible à côté de la barre */}
      <section className="card mb-6">
        <h2 className="mb-1 font-bold">Où en sont vos rendez-vous</h2>
        <p className="mb-4 text-xs text-leaf-800/60">
          Devis envoyés : {totals.devisEnvoyes} · acceptés : {totals.devisAcceptes}
        </p>
        <div className="space-y-2">
          {STATUS_META.map(([key, label, color]) => {
            const n = stats.statuses[key] ?? 0;
            return (
              <div key={key} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 text-leaf-800/80">{label}</span>
                <div className="h-3 flex-1 rounded bg-leaf-50">
                  <div
                    className="h-3 rounded"
                    style={{ width: `${(n / maxStatus) * 100}%`, background: color, minWidth: n ? 6 : 0 }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right font-semibold text-leaf-900">{n}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Chiffre d'affaires facturé : encaissé vs en attente, même teinte */}
      <section className="card">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold">Chiffre d&apos;affaires facturé (HT)</h2>
          <div className="flex items-center gap-3 text-xs text-leaf-800/70">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-leaf-600" /> Encaissé
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-leaf-300" /> En attente
            </span>
          </div>
        </div>
        <p className="mb-4 text-xs text-leaf-800/60">
          Calculé à partir de vos factures (section Devis &amp; Factures).
        </p>
        <p className="mb-1 text-[11px] text-leaf-800/50">Maximum : {euros(maxMonth)}</p>
        <div className="overflow-x-auto" ref={monthScroll}>
          <div className="flex min-w-[30rem] items-end gap-2 border-b border-leaf-100" style={{ height: 160 }}>
            {stats.months.map((m) => {
              const h = (m.facture / maxMonth) * 130;
              const paid = m.facture ? (m.encaisse / m.facture) * h : 0;
              const waiting = h - paid;
              return (
                <div key={m.month} className="flex flex-1 flex-col items-center justify-end">
                  <div
                    className="flex w-full flex-col justify-end"
                    style={{ height: h }}
                    title={`${shortMonth(m.month)} : ${euros(m.facture)} facturés, ${euros(m.encaisse)} encaissés`}
                  >
                    {waiting > 0.5 && (
                      <div className="rounded-t-[4px] bg-leaf-300" style={{ height: waiting }} />
                    )}
                    {paid > 0.5 && (
                      <div
                        className={`bg-leaf-600 ${waiting > 0.5 ? "" : "rounded-t-[4px]"}`}
                        style={{ height: paid, marginTop: waiting > 0.5 ? 2 : 0 }}
                      />
                    )}
                    {m.facture === 0 && <div className="h-[2px] w-full rounded bg-leaf-100" />}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex min-w-[30rem] gap-2">
            {stats.months.map((m) => (
              <span key={m.month} className="flex-1 text-center text-[10px] text-leaf-800/50">
                {shortMonth(m.month)}
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
