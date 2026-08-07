"use client";

// Vue gérant : tous les professionnels et leurs disponibilités déclarées.
import { useEffect, useState } from "react";
import { PRO_STATUS_META } from "@/lib/proStatus";

type Pro = {
  id: string;
  name: string;
  email: string;
  phone: string;
  baseAddress: string;
  baseCity: string;
  basePostalCode: string;
  radiusKm: number;
  status: string;
  availableDays: number;
  datesJson: string;
  devisSlotsJson: string;
  note: string;
  updatedAt: string;
};

function fmtSlots(json: string): string {
  try {
    const slots: string[] = JSON.parse(json);
    if (!slots.length) return "—";
    return slots.map((s) => s.replace(":", "h")).join(" · ");
  } catch {
    return "—";
  }
}

function fmtDates(json: string): string {
  try {
    const dates: string[] = JSON.parse(json);
    if (!dates.length) return "—";
    return dates
      .slice(0, 8)
      .map((d) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }))
      .join(", ") + (dates.length > 8 ? `… (+${dates.length - 8})` : "");
  } catch {
    return "—";
  }
}

export default function AdminProsPage() {
  const [pros, setPros] = useState<Pro[]>([]);
  const [loading, setLoading] = useState(true);

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

  const available = pros.filter((p) => p.status !== "indisponible");

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Professionnels ({pros.length})</h1>
        <span className="text-sm text-leaf-800/60">{available.length} disponible(s)</span>
      </div>

      {loading && <p className="py-8 text-center text-leaf-800/60">Chargement…</p>}
      {!loading && pros.length === 0 && (
        <p className="card py-8 text-center text-leaf-800/60">
          Aucun professionnel inscrit. Partagez le lien <b>/pro</b> à votre équipe.
        </p>
      )}

      <div className="space-y-3">
        {pros.map((p) => {
          const meta = PRO_STATUS_META[p.status] ?? PRO_STATUS_META.indisponible;
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
                <span
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.badge}`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: meta.dot }} />
                  {meta.label}
                </span>
              </div>
              <div className="mt-3 grid gap-1 border-t border-leaf-100 pt-3 text-sm">
                <p>
                  <a className="text-leaf-700 underline" href={`tel:${p.phone}`}>{p.phone || "—"}</a>
                  {" · "}
                  <a className="text-leaf-700 underline" href={`mailto:${p.email}`}>{p.email}</a>
                </p>
                <p>{p.availableDays} journée(s) annoncée(s)</p>
                <p>{fmtDates(p.datesJson)}</p>
                <p>Créneaux devis : {fmtSlots(p.devisSlotsJson)}</p>
                {p.note && <p className="rounded-xl bg-sand-50 p-3 text-leaf-800/80">{p.note}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
