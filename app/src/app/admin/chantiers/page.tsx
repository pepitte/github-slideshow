"use client";

// Chantiers : les rapports d'intervention avant / après remplis par les
// paysagistes depuis leur pointage. Une carte = une journée sur un chantier.
import { useEffect, useState } from "react";

type Rapport = {
  id: string;
  date: string;
  validated: boolean;
  pro: { id: string; name: string } | null;
  avant: string[];
  apres: string[];
  booking: {
    id: string;
    contactId: string | null;
    firstName: string;
    lastName: string;
    city: string;
    address: string;
    projectType: string;
  } | null;
};
type ClientLite = { id: string; firstName: string; lastName: string };

const PRESTATIONS: Record<string, string> = {
  entretien: "Entretien de jardin",
  taille_haie: "Taille de haie",
  debroussaillage: "Débroussaillage",
  contrat_annuel: "Contrat d'entretien",
  autre: "Autre projet",
};

function jourFr(d: string): string {
  return new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Vignettes avant / après côte à côte : c'est le cœur du rapport. */
function Duo({ avant, apres }: { avant: string[]; apres: string[] }) {
  const [agrandie, setAgrandie] = useState<string | null>(null);
  const bloc = (titre: string, liste: string[]) => (
    <div className="min-w-0 flex-1">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-leaf-800/50">
        {titre}
      </p>
      {liste.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-leaf-200 text-xs text-leaf-800/40">
          aucune photo
        </div>
      ) : (
        <div className="flex gap-1">
          {liste.slice(0, 2).map((p, i) => (
            <button
              key={i}
              onClick={() => setAgrandie(p)}
              className="relative h-24 min-w-0 flex-1 overflow-hidden rounded-lg"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt={`${titre} ${i + 1}`} className="h-full w-full object-cover" />
              {i === 1 && liste.length > 2 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-bold text-white">
                  +{liste.length - 2}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
  return (
    <>
      <div className="flex gap-2">
        {bloc("Avant", avant)}
        {bloc("Après", apres)}
      </div>
      {agrandie && (
        <button
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setAgrandie(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={agrandie} alt="Photo du chantier" className="max-h-full max-w-full rounded-xl" />
        </button>
      )}
    </>
  );
}

export default function AdminChantiersPage() {
  const [rapports, setRapports] = useState<Rapport[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [compteurs, setCompteurs] = useState({ enCours: 0, termines: 0, total: 0 });
  const [etat, setEtat] = useState<"en_cours" | "termines">("en_cours");
  const [client, setClient] = useState("");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [vitrine, setVitrine] = useState<string[]>([]);

  function charger() {
    const p = new URLSearchParams({ etat });
    if (client) p.set("client", client);
    fetch(`/api/admin/chantiers?${p.toString()}`)
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/admin/login";
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then((d) => {
        setRapports(d.rapports ?? []);
        setClients(d.clients ?? []);
        setCompteurs(d.compteurs ?? { enCours: 0, termines: 0, total: 0 });
      })
      .catch(() => {})
      .finally(() => setChargement(false));
    fetch("/api/admin/gallery")
      .then((r) => (r.ok ? r.json() : { photos: [] }))
      .then((d) => setVitrine(d.photos ?? []))
      .catch(() => {});
  }

  useEffect(() => {
    setChargement(true);
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat, client]);

  async function agir(id: string, patch: Record<string, unknown>) {
    setErreur("");
    const res = await fetch(`/api/admin/chantiers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErreur(d.error ?? "Action impossible.");
      return;
    }
    charger();
  }

  async function supprimer(r: Rapport) {
    if (
      !window.confirm(
        "Supprimer les photos de ce rapport ?\n\nLes heures pointées de la journée sont conservées : elles servent à la paie."
      )
    )
      return;
    const res = await fetch(`/api/admin/chantiers/${r.id}`, { method: "DELETE" });
    if (res.ok) charger();
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-bold">Chantiers</h1>
      <p className="mb-5 text-sm text-leaf-800/60">Rapports d&apos;intervention avant / après</p>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-xl bg-leaf-50 p-1">
          {(
            [
              ["en_cours", `En cours (${compteurs.enCours})`],
              ["termines", `Terminés (${compteurs.termines})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setEtat(id)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                etat === id ? "bg-white text-leaf-800 shadow-sm" : "text-leaf-800/60"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {clients.length > 0 && (
          <select className="input !w-auto" value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="">Tous les clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {`${c.firstName} ${c.lastName}`.trim() || "Sans nom"}
              </option>
            ))}
          </select>
        )}
      </div>

      {erreur && <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{erreur}</p>}

      {chargement && <p className="py-8 text-center text-leaf-800/60">Chargement…</p>}

      {!chargement && rapports.length === 0 && (
        <div className="card py-8 text-center text-sm text-leaf-800/60">
          {compteurs.total === 0 ? (
            <>
              Aucun rapport pour l&apos;instant. Vos paysagistes en créent un en ajoutant des photos
              <b> avant / après</b> à leur journée, depuis <b>Ma journée</b> dans leur espace.
            </>
          ) : (
            "Aucun rapport ne correspond à ce filtre."
          )}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {rapports.map((r) => {
          const enVitrine = r.apres.length > 0 && vitrine.includes(r.apres[0]);
          const nom = r.booking
            ? `${r.booking.firstName} ${r.booking.lastName}`.trim() || "Client sans nom"
            : "Chantier sans rendez-vous";
          return (
            <article
              key={r.id}
              className={`card !p-4 ${r.validated ? "border-leaf-300 bg-leaf-50/40" : ""}`}
            >
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-leaf-50 text-leaf-700">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold">{nom}</p>
                  <p className="text-sm text-leaf-800/70">{jourFr(r.date)}</p>
                  <p className="text-xs text-leaf-800/60">
                    Créé par : {r.pro?.name ?? "—"}
                    {r.booking?.city ? ` · ${r.booking.city}` : ""}
                    {r.booking ? ` · ${PRESTATIONS[r.booking.projectType] ?? ""}` : ""}
                  </p>
                </div>
              </div>

              <Duo avant={r.avant} apres={r.apres} />

              <div className="mt-3 flex items-center gap-3 border-t border-leaf-100 pt-3 text-sm">
                <button
                  onClick={() => agir(r.id, { validated: !r.validated })}
                  className={`flex items-center gap-1.5 font-semibold ${
                    r.validated ? "text-leaf-800/60" : "text-leaf-700"
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                    <path d="m4 12 5 5L20 6" />
                  </svg>
                  {r.validated ? "Rouvrir" : "Terminer"}
                </button>

                <button
                  onClick={() => agir(r.id, { publier: !enVitrine })}
                  title={
                    enVitrine
                      ? "Retirer cette photo de la page d'accueil"
                      : "Mettre la photo « après » en vitrine sur la page d'accueil"
                  }
                  className={enVitrine ? "text-amber-500" : "text-leaf-800/30 hover:text-amber-500"}
                  disabled={r.apres.length === 0}
                >
                  <svg viewBox="0 0 24 24" fill={enVitrine ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                    <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z" />
                  </svg>
                </button>

                <button
                  onClick={() => supprimer(r)}
                  title="Supprimer les photos (les heures pointées sont conservées)"
                  className="ml-auto text-red-500 hover:text-red-700"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                  </svg>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
