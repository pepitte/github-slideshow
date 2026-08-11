"use client";

// « Tous les clients » : la base exhaustive des contacts entrants, qu'ils aient
// donné lieu à un rendez-vous ou non. Recherche et filtres côté serveur.
import { useEffect, useState } from "react";
import { ORIGINES } from "@/lib/contactLabels";
import FicheContact from "./FicheContact";

export type Contact = {
  id: string;
  createdAt: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  origine: string;
  notes: string;
  agenceId: string | null;
  agence: { id: string; nom: string; couleur: string } | null;
  rdvCount: number;
  echangesCount: number;
};

type AgenceLite = { id: string; nom: string; couleur: string };

function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" });
}

export default function AdminClientsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [agences, setAgences] = useState<AgenceLite[]>([]);
  const [total, setTotal] = useState(0);
  const [tronque, setTronque] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [q, setQ] = useState("");
  const [origine, setOrigine] = useState("");
  const [agence, setAgence] = useState("");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [nouveau, setNouveau] = useState(false);
  const [reprise, setReprise] = useState("");
  const [repriseEnCours, setRepriseEnCours] = useState(false);
  const [brouillon, setBrouillon] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    postalCode: "",
    city: "",
    note: "",
  });

  function charger() {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (origine) p.set("origine", origine);
    if (agence) p.set("agence", agence);
    fetch(`/api/admin/contacts?${p.toString()}`)
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/admin/login";
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then((d) => {
        setContacts(d.contacts ?? []);
        setTotal(d.total ?? 0);
        setTronque(Boolean(d.tronque));
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
  }, [q, origine, agence]);

  async function lancerReprise() {
    if (
      !window.confirm(
        "Reprendre les rendez-vous, prospects et comptes existants pour remplir la base clients ?\nL'opération peut être relancée sans risque : elle ne crée pas de doublon."
      )
    )
      return;
    setRepriseEnCours(true);
    setReprise("");
    const res = await fetch("/api/admin/contacts/reprise", { method: "POST" });
    const d = await res.json();
    setRepriseEnCours(false);
    setReprise(d.message ?? d.error ?? "Reprise impossible.");
    charger();
  }

  async function creer() {
    const res = await fetch("/api/admin/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(brouillon),
    });
    if (res.ok) {
      setNouveau(false);
      setBrouillon({ firstName: "", lastName: "", phone: "", email: "", postalCode: "", city: "", note: "" });
      charger();
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Tous les clients ({total})</h1>
          <p className="text-sm text-leaf-800/60">
            Tout ce qui est entré : appels, formulaires, publicités, réservations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary !px-3 !py-2 text-sm" onClick={lancerReprise} disabled={repriseEnCours}>
            {repriseEnCours ? "Reprise…" : "Reprendre l'existant"}
          </button>
          <button className="btn-primary !w-auto !px-4 !py-2 text-sm" onClick={() => setNouveau(true)}>
            Ajouter un client
          </button>
        </div>
      </div>

      {reprise && (
        <p className="mb-3 rounded-xl bg-leaf-50 px-4 py-3 text-sm font-medium text-leaf-800">{reprise}</p>
      )}

      {nouveau && (
        <div className="card mb-4 space-y-2 border-2 border-leaf-300">
          <p className="font-semibold">Nouveau client</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="input"
              placeholder="Prénom"
              value={brouillon.firstName}
              onChange={(e) => setBrouillon({ ...brouillon, firstName: e.target.value })}
            />
            <input
              className="input"
              placeholder="Nom"
              value={brouillon.lastName}
              onChange={(e) => setBrouillon({ ...brouillon, lastName: e.target.value })}
            />
            <input
              className="input"
              placeholder="Téléphone"
              value={brouillon.phone}
              onChange={(e) => setBrouillon({ ...brouillon, phone: e.target.value })}
            />
            <input
              className="input"
              placeholder="Email"
              value={brouillon.email}
              onChange={(e) => setBrouillon({ ...brouillon, email: e.target.value })}
            />
            <input
              className="input"
              placeholder="Code postal"
              value={brouillon.postalCode}
              onChange={(e) => setBrouillon({ ...brouillon, postalCode: e.target.value })}
            />
            <input
              className="input"
              placeholder="Ville"
              value={brouillon.city}
              onChange={(e) => setBrouillon({ ...brouillon, city: e.target.value })}
            />
          </div>
          <textarea
            className="input"
            rows={2}
            placeholder="Ce qu'il demande (noté pendant l'appel)"
            value={brouillon.note}
            onChange={(e) => setBrouillon({ ...brouillon, note: e.target.value })}
          />
          <div className="flex gap-2">
            <button className="btn-primary !w-auto !px-4 !py-2 text-sm" onClick={creer}>
              Enregistrer
            </button>
            <button className="btn-secondary !px-4 !py-2 text-sm" onClick={() => setNouveau(false)}>
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="input flex-1 !w-auto"
          placeholder="Rechercher : nom, téléphone, email, ville…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input !w-auto" value={origine} onChange={(e) => setOrigine(e.target.value)}>
          <option value="">Toutes origines</option>
          {Object.entries(ORIGINES).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
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

      {tronque && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Liste limitée aux 200 plus récents — affinez la recherche.
        </p>
      )}

      {chargement && <p className="py-8 text-center text-leaf-800/60">Chargement…</p>}

      {!chargement && contacts.length === 0 && (
        <div className="card py-8 text-center text-sm text-leaf-800/60">
          {q || origine || agence ? (
            "Aucun client ne correspond."
          ) : (
            <>
              La base est vide. Si vous aviez déjà des rendez-vous et des prospects, cliquez sur
              <b> Reprendre l&apos;existant</b> : ils seront regroupés en fiches clients.
            </>
          )}
        </div>
      )}

      <div className="space-y-2">
        {contacts.map((c) => (
          <div key={c.id} className="card !p-0 overflow-hidden">
            <button
              className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 p-3 text-left hover:bg-leaf-50"
              onClick={() => setOuvert(ouvert === c.id ? null : c.id)}
            >
              <span className="font-semibold">
                {`${c.firstName} ${c.lastName}`.trim() || "Sans nom"}
              </span>
              {c.city && <span className="text-sm text-leaf-800/70">{c.city}</span>}
              {c.agence && (
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                  style={{ background: c.agence.couleur }}
                >
                  {c.agence.nom}
                </span>
              )}
              <span className="ml-auto flex items-center gap-2 text-xs text-leaf-800/60">
                <span className="rounded-full bg-sand-50 px-2 py-0.5">
                  {ORIGINES[c.origine] ?? c.origine}
                </span>
                {c.rdvCount > 0 && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-800">
                    {c.rdvCount} RDV
                  </span>
                )}
                <span>{dateCourte(c.createdAt)}</span>
              </span>
            </button>
            {ouvert === c.id && <FicheContact id={c.id} agences={agences} onChange={charger} />}
          </div>
        ))}
      </div>
    </main>
  );
}
