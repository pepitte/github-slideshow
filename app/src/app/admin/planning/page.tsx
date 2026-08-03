"use client";

// Planning patron : calendrier mensuel croisant les RDV clients
// et les disponibilités déclarées par les professionnels.
import { useEffect, useMemo, useState } from "react";
import AdminNav from "../AdminNav";
import { PRO_STATUS_META } from "@/lib/proStatus";

type Booking = {
  id: string;
  kind: string;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  projectType: string;
  startAt: string;
  endAt: string;
  status: string;
};
type Pro = {
  id: string;
  name: string;
  phone: string;
  status: string;
  radiusKm: number;
  baseCity: string;
  datesJson: string;
  devisSlotsJson: string;
};

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function parisDay(iso: string): string {
  const p = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  return p; // AAAA-MM-JJ
}
function parisTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(":", "h");
}

export default function PlanningPage() {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pros, setPros] = useState<Pro[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/planning?month=${ymKey(month)}`)
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/admin/login";
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then((data) => {
        setBookings(data.bookings ?? []);
        setPros(data.pros ?? []);
      })
      .finally(() => setLoading(false));
  }, [month]);

  const bookingsByDay = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    for (const b of bookings) {
      const key = parisDay(b.startAt);
      (map[key] ??= []).push(b);
    }
    return map;
  }, [bookings]);

  const prosByDay = useMemo(() => {
    const map: Record<string, Pro[]> = {};
    for (const p of pros) {
      if (p.status === "indisponible") continue;
      try {
        for (const d of JSON.parse(p.datesJson) as string[]) {
          (map[d] ??= []).push(p);
        }
      } catch {}
    }
    return map;
  }, [pros]);

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const startWeekday = (first.getDay() + 6) % 7; // lundi = 0
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < startWeekday; i++) out.push(null);
    for (let d = 1; d <= total; d++) {
      out.push(`${ymKey(month)}-${String(d).padStart(2, "0")}`);
    }
    return out;
  }, [month]);

  const todayStr = parisDay(new Date().toISOString());
  const dayBookings = selected ? bookingsByDay[selected] ?? [] : [];
  const dayPros = selected ? prosByDay[selected] ?? [] : [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <AdminNav />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Planning</h1>
        <div className="flex items-center gap-2">
          <button className="btn-secondary !px-3 !py-1.5" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button>
          <span className="min-w-[10rem] text-center font-semibold capitalize">
            {month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          </span>
          <button className="btn-secondary !px-3 !py-1.5" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-3 text-xs text-leaf-800/70">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> RDV devis</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Chantier</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-leaf-200" /> Pro disponible (point coloré = statut)</span>
      </div>

      {loading ? (
        <p className="py-10 text-center text-leaf-800/60">Chargement…</p>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-leaf-800/50">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
              <span key={d} className="py-1">{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) =>
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
                  <span className={`text-xs font-semibold ${day === todayStr ? "rounded bg-leaf-600 px-1 text-white" : "text-leaf-900"}`}>
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
                      <a className="ml-auto text-leaf-700 underline" href={`tel:${b.phone}`}>
                        {b.phone}
                      </a>
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
                          <a className="ml-auto text-leaf-700 underline" href={`tel:${p.phone}`}>
                            {p.phone || ""}
                          </a>
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
        </>
      )}
    </main>
  );
}
