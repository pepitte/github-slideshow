"use client";

// Agenda d'équipe : une colonne par paysagiste, vue Jour par défaut. C'est la
// vue à ouvrir quand un client est au téléphone — les trous se lisent
// verticalement, sans ouvrir chaque agenda un par un.
import { useEffect, useMemo, useState } from "react";

type Pro = {
  id: string;
  name: string;
  phone: string;
  baseCity: string;
  radiusKm: number;
  agenceId: string | null;
  jours: string[];
  dispo: Record<string, string[]>;
  absents: string[];
};
type Booking = {
  id: string;
  proId: string;
  kind: string;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  address: string;
  startAt: string;
  endAt: string;
};
type Agence = { id: string; nom: string; couleur: string };
type Creneau = {
  startAt: string;
  date: string;
  heure: string;
  pro: { id: string; name: string; phone: string; distance: number | null } | null;
};

const HEURE_DEBUT = 7;
const HEURE_FIN = 20;
const PX_HEURE = 56;

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function ajouter(jour: string, n: number): string {
  const d = new Date(`${jour}T12:00:00`);
  d.setDate(d.getDate() + n);
  return ymd(d);
}
function minutesParis(iso: string): number {
  const s = new Date(iso).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}
function heureParis(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })
    .replace(":", "h");
}
function libelleJour(jour: string): string {
  const l = new Date(`${jour}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return l.charAt(0).toUpperCase() + l.slice(1);
}

export default function AdminEquipePage() {
  const [jour, setJour] = useState(() => ymd(new Date()));
  const [agence, setAgence] = useState("");
  const [agences, setAgences] = useState<Agence[]>([]);
  const [pros, setPros] = useState<Pro[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [chargement, setChargement] = useState(true);
  const [cp, setCp] = useState("");
  const [creneaux, setCreneaux] = useState<Creneau[] | null>(null);
  const [recherche, setRecherche] = useState(false);

  // Le secteur choisi est mémorisé : le gérant travaille sur une ville à la fois.
  useEffect(() => {
    const memorise = window.localStorage.getItem("agenceEquipe") ?? "";
    setAgence(memorise);
  }, []);

  useEffect(() => {
    setChargement(true);
    const p = new URLSearchParams({ du: jour, au: jour });
    if (agence) p.set("agence", agence);
    fetch(`/api/admin/equipe?${p.toString()}`)
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/admin/login";
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then((d) => {
        setAgences(d.agences ?? []);
        setPros(d.pros ?? []);
        setBookings(d.bookings ?? []);
      })
      .catch(() => {})
      .finally(() => setChargement(false));
  }, [jour, agence]);

  function choisirAgence(id: string) {
    setAgence(id);
    window.localStorage.setItem("agenceEquipe", id);
  }

  async function chercherCreneaux() {
    if (!/^\d{5}$/.test(cp.trim())) return;
    setRecherche(true);
    setCreneaux(null);
    const res = await fetch(`/api/admin/equipe/creneaux?cp=${cp.trim()}&n=6`);
    const d = await res.json();
    setRecherche(false);
    setCreneaux(d.creneaux ?? []);
  }

  const heures = useMemo(
    () => Array.from({ length: HEURE_FIN - HEURE_DEBUT + 1 }, (_, i) => HEURE_DEBUT + i),
    []
  );
  const parPro = useMemo(() => {
    const m: Record<string, Booking[]> = {};
    for (const b of bookings) (m[b.proId] ??= []).push(b);
    return m;
  }, [bookings]);

  const aujourdhui = ymd(new Date());

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Agenda d&apos;équipe</h1>
          <p className="text-sm text-leaf-800/60">
            Tous les paysagistes du secteur en parallèle, pour proposer un créneau sans ouvrir
            chaque agenda.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary !px-3 !py-1.5" onClick={() => setJour(ajouter(jour, -1))}>
            ←
          </button>
          <button className="btn-secondary !px-3 !py-1.5" onClick={() => setJour(aujourdhui)}>
            Aujourd&apos;hui
          </button>
          <button className="btn-secondary !px-3 !py-1.5" onClick={() => setJour(ajouter(jour, 1))}>
            →
          </button>
          <input
            className="input !w-auto !py-1.5"
            type="date"
            value={jour}
            onChange={(e) => e.target.value && setJour(e.target.value)}
          />
        </div>
      </div>

      {agences.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => choisirAgence("")}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
              agence === "" ? "bg-leaf-700 text-white" : "bg-leaf-50 text-leaf-800/70"
            }`}
          >
            Tous les secteurs
          </button>
          {agences.map((a) => (
            <button
              key={a.id}
              onClick={() => choisirAgence(a.id)}
              className="rounded-full px-3 py-1.5 text-sm font-semibold transition"
              style={
                agence === a.id
                  ? { background: a.couleur, color: "white" }
                  : { background: "#f2f6f1", color: "#3d4a3d" }
              }
            >
              {a.nom}
            </button>
          ))}
        </div>
      )}

      {/* Premier créneau libre : la fonction du coup de téléphone */}
      <div className="card mb-4">
        <p className="mb-2 font-bold">Trouver un créneau pour un client</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input flex-1"
            placeholder="Code postal du client (ex. 33000)"
            value={cp}
            onChange={(e) => setCp(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && chercherCreneaux()}
          />
          <button
            className="btn-primary !w-auto !px-4 !py-2.5 text-sm"
            onClick={chercherCreneaux}
            disabled={recherche}
          >
            {recherche ? "Recherche…" : "Premiers créneaux libres"}
          </button>
        </div>
        {creneaux !== null && (
          <div className="mt-3">
            {creneaux.length === 0 ? (
              <p className="text-sm text-leaf-800/60">
                Aucun créneau disponible pour ce code postal. Vérifiez qu&apos;il est bien dans un
                secteur couvert et qu&apos;un paysagiste a déclaré des disponibilités.
              </p>
            ) : (
              <ul className="space-y-1">
                {creneaux.map((c) => (
                  <li
                    key={c.startAt}
                    className="flex flex-wrap items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm"
                  >
                    <span className="font-bold text-blue-900">
                      {libelleJour(c.date)} à {c.heure.replace(":", "h")}
                    </span>
                    <span className="text-blue-900/80">
                      {c.pro
                        ? `avec ${c.pro.name}${c.pro.distance !== null ? ` — ${c.pro.distance} km` : ""}`
                        : "visite du gérant"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <p className="mb-2 font-semibold capitalize">{libelleJour(jour)}</p>

      <div className="mb-2 flex flex-wrap gap-3 text-xs text-leaf-800/60">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Visite devis
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Chantier
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-leaf-100" /> Disponibilité déclarée
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-gray-300" /> Absent
        </span>
      </div>

      {chargement && <p className="py-8 text-center text-leaf-800/60">Chargement…</p>}

      {!chargement && pros.length === 0 && (
        <p className="card py-8 text-center text-sm text-leaf-800/60">
          Aucun paysagiste dans ce secteur. Rattachez-les depuis l&apos;onglet
          <b> Professionnels</b>.
        </p>
      )}

      {!chargement && pros.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-leaf-100 bg-white">
          <div style={{ minWidth: `${3 + pros.length * 9}rem` }}>
            {/* En-têtes : un paysagiste par colonne */}
            <div
              className="grid border-b border-leaf-100"
              style={{ gridTemplateColumns: `3rem repeat(${pros.length}, minmax(0, 1fr))` }}
            >
              <span />
              {pros.map((p) => {
                const absent = p.absents.includes(jour);
                const dispoJour = (p.dispo[jour] ?? []).length;
                const chantierJour = p.jours.includes(jour);
                return (
                  <div key={p.id} className="border-l border-leaf-100 px-2 py-2 text-center">
                    <p className="truncate text-sm font-bold" title={p.name}>
                      {p.name}
                    </p>
                    <p className="text-[11px] text-leaf-800/60">
                      {absent
                        ? "Absent"
                        : [
                            chantierJour ? "chantier" : "",
                            dispoJour ? `${dispoJour} créneau(x)` : "",
                          ]
                            .filter(Boolean)
                            .join(" · ") || "rien de déclaré"}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Grille horaire */}
            <div
              className="relative grid"
              style={{ gridTemplateColumns: `3rem repeat(${pros.length}, minmax(0, 1fr))` }}
            >
              <div className="relative" style={{ height: heures.length * PX_HEURE }}>
                {heures.map((h, i) => (
                  <span
                    key={h}
                    className="absolute right-1 text-[11px] text-leaf-800/50"
                    style={{ top: i * PX_HEURE - 6 }}
                  >
                    {h}h
                  </span>
                ))}
              </div>

              {pros.map((p) => {
                const absent = p.absents.includes(jour);
                const creneauxJour = p.dispo[jour] ?? [];
                const chantierJour = p.jours.includes(jour);
                return (
                  <div
                    key={p.id}
                    className={`relative border-l border-leaf-100 ${absent ? "bg-gray-100" : ""}`}
                    style={{ height: heures.length * PX_HEURE }}
                  >
                    {heures.map((h, i) => (
                      <span
                        key={h}
                        className="absolute inset-x-0 border-t border-leaf-100/70"
                        style={{ top: i * PX_HEURE }}
                      />
                    ))}

                    {/* Fond vert pâle : ce que le paysagiste a déclaré */}
                    {!absent && chantierJour && (
                      <span
                        className="absolute inset-x-0 bg-leaf-100/60"
                        style={{
                          top: (8 - HEURE_DEBUT) * PX_HEURE,
                          height: 10 * PX_HEURE,
                        }}
                      />
                    )}
                    {!absent &&
                      creneauxJour.map((t) => {
                        const [hh, mm] = t.split(":").map(Number);
                        return (
                          <span
                            key={t}
                            className="absolute inset-x-1 rounded bg-blue-100/70"
                            style={{
                              top: ((hh * 60 + mm) / 60 - HEURE_DEBUT) * PX_HEURE,
                              height: PX_HEURE / 2 - 2,
                            }}
                          />
                        );
                      })}

                    {absent && (
                      <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs font-semibold text-gray-500">
                        Absent
                      </span>
                    )}

                    {/* Rendez-vous */}
                    {(parPro[p.id] ?? []).map((b) => {
                      const debut = Math.max(minutesParis(b.startAt), HEURE_DEBUT * 60);
                      const fin = Math.min(
                        Math.max(minutesParis(b.endAt), debut + 30),
                        HEURE_FIN * 60
                      );
                      const hauteur = ((fin - debut) / 60) * PX_HEURE - 2;
                      return (
                        <div
                          key={b.id}
                          title={`${heureParis(b.startAt)} – ${heureParis(b.endAt)} · ${b.firstName} ${b.lastName} · ${b.address}, ${b.city} · ${b.phone}`}
                          className={`absolute inset-x-1 overflow-hidden rounded-lg px-1.5 py-0.5 text-left text-[11px] font-semibold leading-tight text-white shadow-sm ${
                            b.kind === "chantier" ? "bg-green-500" : "bg-blue-500"
                          }`}
                          style={{
                            top: ((debut - HEURE_DEBUT * 60) / 60) * PX_HEURE + 1,
                            height: hauteur,
                          }}
                        >
                          <span className="block truncate">
                            <span className="font-normal opacity-90">{heureParis(b.startAt)}</span>{" "}
                            {b.firstName} {b.lastName}
                          </span>
                          {hauteur > 34 && (
                            <span className="block truncate font-normal opacity-90">{b.city}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
