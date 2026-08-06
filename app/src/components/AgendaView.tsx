"use client";

// Agenda partagé (gérant + pros) : vues Mois / Semaine / Jour croisant les
// RDV clients (blocs colorés sur grille horaire) et les dispos des pros.
// `showContacts` contrôle l'affichage des téléphones (réservé au gérant).
import { useEffect, useMemo, useState } from "react";
import { PRO_STATUS_META } from "@/lib/proStatus";

type Booking = {
  id: string;
  kind: string;
  firstName: string;
  lastName: string;
  phone?: string;
  city: string;
  projectType: string;
  startAt: string;
  endAt: string;
  status: string;
};
type Pro = {
  id: string;
  name: string;
  phone?: string;
  status: string;
  radiusKm: number;
  baseCity: string;
  datesJson: string;
  devisSlotsJson: string;
};
type View = "mois" | "semaine" | "jour";

// Grille horaire : 7h00 → 20h00 (les chantiers démarrent à 8h, les devis finissent à 20h)
const HOUR_START = 7;
const HOUR_END = 20;
const HOUR_PX = 48;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function keyOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function ymKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function mondayOf(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7));
}
function parisDay(iso: string): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}
/** Minutes depuis minuit, heure de Paris. */
function parisMin(iso: string): number {
  const s = new Date(iso).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}
function parisTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })
    .replace(":", "h");
}

export default function AgendaView({
  endpoint,
  loginPath,
  showContacts = false,
}: {
  endpoint: string;
  loginPath: string;
  showContacts?: boolean;
}) {
  const [view, setView] = useState<View>("semaine");
  const [refDate, setRefDate] = useState(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pros, setPros] = useState<Pro[]>([]);
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const todayKey = keyOf(new Date());

  // Période affichée selon la vue
  const days: string[] = useMemo(() => {
    if (view === "jour") return [keyOf(refDate)];
    if (view === "semaine") {
      const mon = mondayOf(refDate);
      return Array.from({ length: 7 }, (_, i) => keyOf(addDays(mon, i)));
    }
    return [];
  }, [view, refDate]);

  useEffect(() => {
    setLoading(true);
    const url =
      view === "mois"
        ? `${endpoint}?month=${ymKey(refDate)}`
        : `${endpoint}?from=${days[0]}&to=${days[days.length - 1]}`;
    fetch(url)
      .then((r) => {
        if (r.status === 401) {
          window.location.href = loginPath;
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then((data) => {
        setBookings(data.bookings ?? []);
        setPros(data.pros ?? []);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, refDate]);

  // Encart « Aujourd'hui » : toujours alimenté, quelle que soit la période affichée
  useEffect(() => {
    fetch(`${endpoint}?from=${todayKey}&to=${todayKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setTodayBookings(data?.bookings ?? []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bookingsByDay = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    for (const b of bookings) (map[parisDay(b.startAt)] ??= []).push(b);
    return map;
  }, [bookings]);

  const prosByDay = useMemo(() => {
    const map: Record<string, Pro[]> = {};
    for (const p of pros) {
      if (p.status === "indisponible") continue;
      try {
        for (const d of JSON.parse(p.datesJson) as string[]) (map[d] ??= []).push(p);
      } catch {}
    }
    return map;
  }, [pros]);

  function navigate(dir: -1 | 1) {
    setSelected(null);
    setRefDate((d) => {
      if (view === "mois") return new Date(d.getFullYear(), d.getMonth() + dir, 1, 12);
      return addDays(d, dir * (view === "semaine" ? 7 : 1));
    });
  }
  function goToday() {
    setSelected(null);
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    setRefDate(d);
  }

  const periodLabel =
    view === "mois"
      ? refDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
      : view === "semaine"
        ? `Semaine du ${mondayOf(refDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
        : refDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Cellules de la vue Mois (lundi en premier)
  const monthCells = useMemo(() => {
    if (view !== "mois") return [];
    const first = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    const startWeekday = (first.getDay() + 6) % 7;
    const total = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < startWeekday; i++) out.push(null);
    for (let d = 1; d <= total; d++) out.push(`${ymKey(refDate)}-${pad(d)}`);
    return out;
  }, [view, refDate]);

  /** Blocs positionnés d'une journée, avec gestion des chevauchements (colonnes). */
  function dayEvents(day: string) {
    const evts = (bookingsByDay[day] ?? [])
      .map((b) => {
        const start = Math.max(parisMin(b.startAt), HOUR_START * 60);
        const end = Math.min(Math.max(parisMin(b.endAt), start + 30), HOUR_END * 60);
        return { b, start, end, lane: 0 };
      })
      .sort((a, x) => a.start - x.start);
    const lanes: number[] = [];
    for (const e of evts) {
      let lane = lanes.findIndex((endMin) => endMin <= e.start);
      if (lane === -1) {
        lane = lanes.length;
        lanes.push(0);
      }
      lanes[lane] = e.end;
      e.lane = lane;
    }
    return { evts, laneCount: Math.max(lanes.length, 1) };
  }

  const dayBookings = selected ? bookingsByDay[selected] ?? [] : [];
  const dayPros = selected ? prosByDay[selected] ?? [] : [];
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

  function dayHeader(day: string) {
    const d = new Date(`${day}T12:00:00`);
    const isToday = day === todayKey;
    return (
      <button
        key={day}
        onClick={() => setSelected(day === selected ? null : day)}
        className={`flex flex-col items-center gap-0.5 border-b border-leaf-100 px-1 py-2 text-xs font-semibold transition ${
          selected === day ? "bg-leaf-50" : "hover:bg-leaf-50/60"
        }`}
      >
        <span className={isToday ? "text-leaf-700" : "text-leaf-800/60"}>
          {d.toLocaleDateString("fr-FR", { weekday: "short" })}
        </span>
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${
            isToday ? "bg-leaf-600 text-white" : "text-leaf-900"
          }`}
        >
          {Number(day.slice(8))}
        </span>
        <span className="flex flex-wrap justify-center gap-0.5">
          {(prosByDay[day] ?? []).slice(0, 4).map((p) => (
            <span
              key={p.id}
              className="h-1.5 w-1.5 rounded-sm"
              style={{ background: PRO_STATUS_META[p.status]?.dot ?? "#999" }}
            />
          ))}
        </span>
      </button>
    );
  }

  function timeGrid(gridDays: string[]) {
    return (
      <div className="overflow-x-auto rounded-2xl border border-leaf-100 bg-white">
        <div className={gridDays.length > 1 ? "min-w-[680px]" : ""}>
          <div
            className="grid"
            style={{ gridTemplateColumns: `3rem repeat(${gridDays.length}, minmax(0, 1fr))` }}
          >
            <span className="border-b border-leaf-100" />
            {gridDays.map(dayHeader)}

            {/* Colonne des heures */}
            <div className="relative" style={{ height: hours.length * HOUR_PX }}>
              {hours.map((h, i) => (
                <span
                  key={h}
                  className="absolute right-1 text-[10px] text-leaf-800/40"
                  style={{ top: i * HOUR_PX - 6 }}
                >
                  {i === 0 ? "" : `${h}h`}
                </span>
              ))}
            </div>

            {gridDays.map((day) => {
              const { evts, laneCount } = dayEvents(day);
              return (
                <div
                  key={day}
                  className="relative border-l border-leaf-100"
                  style={{ height: hours.length * HOUR_PX }}
                >
                  {hours.map((h, i) => (
                    <span
                      key={h}
                      className="absolute inset-x-0 border-t border-leaf-100/70"
                      style={{ top: i * HOUR_PX }}
                    />
                  ))}
                  {day === todayKey && <span className="absolute inset-0 bg-leaf-50/40" />}
                  {evts.map(({ b, start, end, lane }) => {
                    const width = 100 / laneCount;
                    return (
                      <button
                        key={b.id}
                        onClick={() => setSelected(day)}
                        className={`absolute overflow-hidden rounded-lg px-1.5 py-1 text-left text-[11px] font-semibold leading-tight text-white shadow-sm ${
                          b.kind === "chantier" ? "bg-green-500" : "bg-blue-500"
                        }`}
                        style={{
                          top: ((start - HOUR_START * 60) / 60) * HOUR_PX + 1,
                          height: ((end - start) / 60) * HOUR_PX - 2,
                          left: `calc(${lane * width}% + 2px)`,
                          width: `calc(${width}% - 4px)`,
                        }}
                      >
                        <span className="block truncate">
                          {b.firstName} {b.lastName}
                        </span>
                        <span className="block font-normal opacity-90">
                          {parisTime(b.startAt)} – {parisTime(b.endAt)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Agenda</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary !px-3 !py-1.5" onClick={() => navigate(-1)}>←</button>
          <button className="btn-secondary !px-3 !py-1.5" onClick={goToday}>Aujourd&apos;hui</button>
          <button className="btn-secondary !px-3 !py-1.5" onClick={() => navigate(1)}>→</button>
          <span className="min-w-[11rem] text-center text-sm font-semibold capitalize">{periodLabel}</span>
          <div className="flex rounded-xl bg-leaf-50 p-1">
            {(["mois", "semaine", "jour"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => {
                  setView(v);
                  setSelected(null);
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
                  view === v ? "bg-white text-leaf-800 shadow-sm" : "text-leaf-800/60"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-3 text-xs text-leaf-800/70">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> RDV devis</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Chantier</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-leaf-200" /> Pro disponible (couleur = statut)</span>
      </div>

      {loading ? (
        <p className="py-10 text-center text-leaf-800/60">Chargement…</p>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            {view === "mois" ? (
              <>
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-leaf-800/50">
                  {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
                    <span key={d} className="py-1">{d}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {monthCells.map((day, i) =>
                    day === null ? (
                      <span key={`x${i}`} />
                    ) : (
                      <button
                        key={day}
                        onClick={() => setSelected(day === selected ? null : day)}
                        className={`min-h-[4.2rem] rounded-lg border p-1 text-left align-top transition ${
                          selected === day
                            ? "border-leaf-600 bg-leaf-50 ring-2 ring-leaf-500/30"
                            : "border-leaf-100 bg-white hover:border-leaf-300"
                        }`}
                      >
                        <span className={`text-xs font-semibold ${day === todayKey ? "rounded bg-leaf-600 px-1 text-white" : "text-leaf-900"}`}>
                          {Number(day.slice(8))}
                        </span>
                        <span className="mt-0.5 flex flex-wrap gap-0.5">
                          {(bookingsByDay[day] ?? []).slice(0, 4).map((b) => (
                            <span
                              key={b.id}
                              className={`h-2 w-2 rounded-full ${b.kind === "chantier" ? "bg-green-500" : "bg-blue-500"}`}
                            />
                          ))}
                        </span>
                        <span className="mt-0.5 flex flex-wrap gap-0.5">
                          {(prosByDay[day] ?? []).slice(0, 4).map((p) => (
                            <span
                              key={p.id}
                              className="h-2 w-2 rounded-sm"
                              style={{ background: PRO_STATUS_META[p.status]?.dot ?? "#999" }}
                            />
                          ))}
                        </span>
                      </button>
                    )
                  )}
                </div>
              </>
            ) : (
              timeGrid(days)
            )}

            {selected && (
              <section className="card mt-4">
                <h2 className="mb-3 font-bold capitalize">
                  {new Date(`${selected}T12:00:00`).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </h2>

                <h3 className="mb-2 text-sm font-semibold text-leaf-800/70">
                  Rendez-vous clients ({dayBookings.length})
                </h3>
                {dayBookings.length === 0 ? (
                  <p className="mb-3 text-sm text-leaf-800/50">Aucun rendez-vous ce jour.</p>
                ) : (
                  <div className="mb-3 space-y-2">
                    {dayBookings.map((b) => (
                      <div key={b.id} className="flex items-center gap-2 rounded-xl bg-sand-50 px-3 py-2 text-sm">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${b.kind === "chantier" ? "bg-green-500" : "bg-blue-500"}`} />
                        <span className="font-semibold">
                          {b.kind === "chantier"
                            ? `Chantier dès ${parisTime(b.startAt)} → ${parisTime(b.endAt)}`
                            : parisTime(b.startAt)}
                        </span>
                        <span>
                          {b.firstName} {b.lastName} · {b.city}
                        </span>
                        {showContacts && (
                          <a className="ml-auto text-leaf-700 underline" href={`tel:${b.phone}`}>
                            {b.phone}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <h3 className="mb-2 text-sm font-semibold text-leaf-800/70">
                  Professionnels disponibles ({dayPros.length})
                </h3>
                {dayPros.length === 0 ? (
                  <p className="text-sm text-leaf-800/50">
                    Aucun professionnel n&apos;a déclaré de disponibilité ce jour.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dayPros.map((p) => {
                      const meta = PRO_STATUS_META[p.status] ?? PRO_STATUS_META.indisponible;
                      let slots: string[] = [];
                      try {
                        slots = (JSON.parse(p.devisSlotsJson) as string[]) ?? [];
                      } catch {}
                      return (
                        <div key={p.id} className="rounded-xl bg-sand-50 px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.dot }} />
                            <span className="font-semibold">{p.name}</span>
                            <span className="text-leaf-800/70">
                              {meta.label} · rayon {p.radiusKm} km
                            </span>
                            {showContacts && (
                              <a className="ml-auto text-leaf-700 underline" href={`tel:${p.phone}`}>
                                {p.phone || ""}
                              </a>
                            )}
                          </div>
                          {slots.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1">
                              <span className="text-xs text-leaf-800/60">Heures devis :</span>
                              {slots.map((s) => (
                                <span key={s} className="rounded-md bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-800">
                                  {s.replace(":", "h")}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Encart « Aujourd'hui » */}
          <aside className="card w-full shrink-0 lg:w-64">
            <h2 className="mb-2 font-bold">Aujourd&apos;hui</h2>
            {todayBookings.length === 0 ? (
              <p className="text-sm text-leaf-800/50">Aucun rendez-vous aujourd&apos;hui.</p>
            ) : (
              <div className="space-y-2">
                {todayBookings.map((b) => (
                  <div key={b.id} className="flex items-center gap-2 text-sm">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${b.kind === "chantier" ? "bg-green-500" : "bg-blue-500"}`} />
                    <span className="font-semibold">{parisTime(b.startAt)}</span>
                    <span className="truncate">
                      {b.firstName} {b.lastName}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
