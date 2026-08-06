"use client";

// Gestion terrain : consultation et validation des temps et journées des pros
// (pointages arrivée/départ faits depuis l'espace professionnel).
import { useEffect, useMemo, useState } from "react";
import AdminNav from "../AdminNav";

type Entry = {
  id: string;
  proId: string;
  date: string;
  arrival: string;
  departure: string;
  photosBeforeJson: string;
  photosAfterJson: string;
  validated: boolean;
};
function photosOf(json: string): string[] {
  try {
    const arr = JSON.parse(json || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
type ProLite = { id: string; name: string; phone: string; baseCity: string };
type Period = "jour" | "semaine" | "perso";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function keyOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function minutesOf(hm: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(hm)) return null;
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}
/** "08:02" → "08h02" ; vide → "—" */
function fmtH(hm: string): string {
  return hm ? hm.replace(":", "h") : "—";
}
function totalLabel(e: Entry): string {
  const a = minutesOf(e.arrival);
  const d = minutesOf(e.departure);
  if (a === null || d === null || d <= a) return "—";
  const mins = d - a;
  return `${Math.floor(mins / 60)}h${mins % 60 ? pad(mins % 60) : ""}`;
}
function totalMinutes(e: Entry): number {
  const a = minutesOf(e.arrival);
  const d = minutesOf(e.departure);
  return a !== null && d !== null && d > a ? d - a : 0;
}

export default function TerrainPage() {
  const [tab, setTab] = useState<"fiches" | "suivi">("fiches");
  const [period, setPeriod] = useState<Period>("jour");
  const [customFrom, setCustomFrom] = useState(() => keyOf(new Date()));
  const [customTo, setCustomTo] = useState(() => keyOf(new Date()));
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pros, setPros] = useState<ProLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [openPhotos, setOpenPhotos] = useState<string | null>(null);

  const todayKey = keyOf(new Date());
  const range = useMemo(() => {
    if (period === "jour") return { from: todayKey, to: todayKey };
    if (period === "semaine") {
      const monday = addDays(new Date(), -((new Date().getDay() + 6) % 7));
      return { from: keyOf(monday), to: keyOf(addDays(monday, 6)) };
    }
    return { from: customFrom, to: customTo };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customFrom, customTo]);

  function load() {
    setLoading(true);
    fetch(`/api/admin/terrain?from=${range.from}&to=${range.to}`)
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/admin/login";
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then((data) => {
        setEntries(data.entries ?? []);
        setPros(data.pros ?? []);
      })
      .finally(() => setLoading(false));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [range.from, range.to]);

  async function setValidated(id: string, validated: boolean) {
    const res = await fetch("/api/admin/terrain", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, validated }),
    });
    if (res.ok) {
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, validated } : e)));
    }
  }

  const proById = useMemo(() => {
    const m: Record<string, ProLite> = {};
    for (const p of pros) m[p.id] = p;
    return m;
  }, [pros]);

  const filteredPros = useMemo(
    () => pros.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase())),
    [pros, search]
  );

  // Lignes du tableau : sur une seule journée, tous les pros (même sans pointage) ;
  // sur une période, uniquement les journées pointées.
  type Row = { pro: ProLite; date: string; entry: Entry | null };
  const rows: Row[] = useMemo(() => {
    const bySearch = (name: string) => name.toLowerCase().includes(search.trim().toLowerCase());
    if (range.from === range.to) {
      return filteredPros.map((pro) => ({
        pro,
        date: range.from,
        entry: entries.find((e) => e.proId === pro.id && e.date === range.from) ?? null,
      }));
    }
    return entries
      .filter((e) => proById[e.proId] && bySearch(proById[e.proId].name))
      .map((e) => ({ pro: proById[e.proId], date: e.date, entry: e }));
  }, [entries, filteredPros, proById, range, search]);

  // Onglet Suivi : totaux par pro sur la période
  const summary = useMemo(() => {
    return filteredPros
      .map((pro) => {
        const mine = entries.filter((e) => e.proId === pro.id);
        const complete = mine.filter((e) => totalMinutes(e) > 0);
        const mins = complete.reduce((acc, e) => acc + totalMinutes(e), 0);
        return {
          pro,
          days: complete.length,
          validated: mine.filter((e) => e.validated).length,
          label: mins ? `${Math.floor(mins / 60)}h${mins % 60 ? pad(mins % 60) : ""}` : "—",
        };
      })
      .sort((a, b) => b.days - a.days);
  }, [entries, filteredPros]);

  function statusBadge(entry: Entry | null) {
    if (entry?.validated) {
      return <span className="rounded-full bg-leaf-100 px-2.5 py-0.5 text-[11px] font-semibold text-leaf-800">Validée</span>;
    }
    if (entry && entry.arrival && entry.departure) {
      return <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-800">Complet</span>;
    }
    return <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">Incomplet</span>;
  }

  const dateLabel = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <AdminNav />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Gestion terrain</h1>
          <p className="text-sm text-leaf-800/60">Consultation et validation des temps et journées</p>
        </div>
        <div className="flex rounded-xl bg-leaf-50 p-1">
          {([["fiches", "Fiches & journées"], ["suivi", "Suivi"]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                tab === id ? "bg-white text-leaf-800 shadow-sm" : "text-leaf-800/60"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {([["jour", "Aujourd'hui"], ["semaine", "Cette semaine"], ["perso", "Date personnalisée"]] as const).map(
          ([id, label]) => (
            <button
              key={id}
              onClick={() => setPeriod(id)}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                period === id ? "bg-leaf-600 text-white" : "bg-white text-leaf-800 ring-1 ring-leaf-200"
              }`}
            >
              {label}
            </button>
          )
        )}
        {period === "perso" && (
          <span className="flex items-center gap-2 text-sm">
            <input type="date" className="input !w-auto !py-2" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            →
            <input type="date" className="input !w-auto !py-2" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </span>
        )}
      </div>

      <input
        className="input mb-4"
        placeholder="Rechercher un professionnel…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <p className="py-10 text-center text-leaf-800/60">Chargement…</p>
      ) : pros.length === 0 ? (
        <p className="card py-8 text-center text-sm text-leaf-800/60">
          Aucun professionnel inscrit pour le moment.
        </p>
      ) : tab === "fiches" ? (
        <div className="overflow-x-auto rounded-2xl border border-leaf-100 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-leaf-100 text-left text-xs uppercase tracking-wide text-leaf-800/50">
                <th className="px-4 py-3">Professionnel</th>
                {range.from !== range.to && <th className="px-4 py-3">Date</th>}
                <th className="px-4 py-3">Arrivée</th>
                <th className="px-4 py-3">Départ</th>
                <th className="px-4 py-3">Total heures</th>
                <th className="px-4 py-3">Photos</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Journée</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-leaf-800/50">
                    Aucune journée pointée sur cette période.
                  </td>
                </tr>
              )}
              {rows.map(({ pro, date, entry }) => {
                const before = entry ? photosOf(entry.photosBeforeJson) : [];
                const after = entry ? photosOf(entry.photosAfterJson) : [];
                const nbPhotos = before.length + after.length;
                return (
                <>
                <tr key={`${pro.id}-${date}`} className="border-b border-leaf-100/60 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{pro.name}</p>
                    {pro.baseCity && <p className="text-xs text-leaf-800/50">{pro.baseCity}</p>}
                  </td>
                  {range.from !== range.to && <td className="px-4 py-3 capitalize">{dateLabel(date)}</td>}
                  <td className="px-4 py-3">{fmtH(entry?.arrival ?? "")}</td>
                  <td className="px-4 py-3">{fmtH(entry?.departure ?? "")}</td>
                  <td className="px-4 py-3 font-semibold">{entry ? totalLabel(entry) : "—"}</td>
                  <td className="px-4 py-3">
                    {nbPhotos > 0 && entry ? (
                      <button
                        className="text-xs font-semibold text-leaf-700 underline"
                        onClick={() => setOpenPhotos(openPhotos === entry.id ? null : entry.id)}
                      >
                        {nbPhotos} photo{nbPhotos > 1 ? "s" : ""}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">{statusBadge(entry)}</td>
                  <td className="px-4 py-3">
                    {entry && entry.arrival && entry.departure ? (
                      entry.validated ? (
                        <button
                          className="text-xs font-semibold text-leaf-800/50 underline"
                          onClick={() => setValidated(entry.id, false)}
                        >
                          Annuler la validation
                        </button>
                      ) : (
                        <button
                          className="rounded-lg bg-leaf-600 px-3 py-1.5 text-xs font-semibold text-white"
                          onClick={() => setValidated(entry.id, true)}
                        >
                          Valider
                        </button>
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
                {entry && openPhotos === entry.id && (
                  <tr key={`${pro.id}-${date}-photos`} className="border-b border-leaf-100/60">
                    <td colSpan={8} className="bg-sand-50 px-4 py-3">
                      <div className="flex flex-wrap gap-6">
                        {[["Avant le chantier", before] as const, ["Après le chantier", after] as const].map(
                          ([label, list]) =>
                            list.length > 0 && (
                              <div key={label}>
                                <p className="mb-1.5 text-xs font-semibold text-leaf-800/60">{label}</p>
                                <div className="flex flex-wrap gap-2">
                                  {list.map((src, i) => (
                                    <a key={i} href={src} target="_blank" rel="noreferrer">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={src}
                                        alt={`${label} ${i + 1}`}
                                        className="h-24 w-24 rounded-xl border border-leaf-200 object-cover"
                                      />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-leaf-100 bg-white">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-leaf-100 text-left text-xs uppercase tracking-wide text-leaf-800/50">
                <th className="px-4 py-3">Professionnel</th>
                <th className="px-4 py-3">Journées pointées</th>
                <th className="px-4 py-3">Journées validées</th>
                <th className="px-4 py-3">Total heures</th>
              </tr>
            </thead>
            <tbody>
              {summary.map(({ pro, days, validated, label }) => (
                <tr key={pro.id} className="border-b border-leaf-100/60 last:border-0">
                  <td className="px-4 py-3 font-semibold">{pro.name}</td>
                  <td className="px-4 py-3">{days}</td>
                  <td className="px-4 py-3">{validated}</td>
                  <td className="px-4 py-3 font-semibold">{label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
