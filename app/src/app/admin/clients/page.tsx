"use client";

// « Tous les clients » : la base exhaustive des contacts entrants, qu'ils aient
// donné lieu à un rendez-vous ou non. Tuiles de synthèse puis tableau ; une
// ligne s'ouvre sur la fiche complète (coordonnées, RDV, journal des échanges).
import { Fragment, useEffect, useState } from "react";
import FicheContact from "./FicheContact";
import AddressAutocomplete, { type AddressValue } from "@/components/AddressAutocomplete";
import { telFr } from "@/lib/rdvLabels";
import { ETAPE_PAR_ID, SUIVI_SIMPLE } from "@/lib/pipeline";

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
  caGenere: number;
  contrat: "annuel" | "ponctuel";
  affairesCount: number;
  perdu: boolean;
  affaireId: string | null;
  affaireStatut: string;
  dernierEchange: string | null;
};

type Stats = { total: number; actifs: number; perdus: number; caTotal: number };
type AgenceLite = { id: string; nom: string; couleur: string };

function euros(n: number): string {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}
/** Tuile de synthèse : le chiffre d'abord, l'explication ensuite. */
function Tuile({
  label,
  valeur,
  couleur,
  icone,
}: {
  label: string;
  valeur: string;
  couleur: string;
  icone: React.ReactNode;
}) {
  return (
    <div className="card flex items-start justify-between gap-3 !p-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-leaf-800/50">{label}</p>
        <p className="mt-1 text-2xl font-bold" style={{ color: couleur }}>
          {valeur}
        </p>
      </div>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${couleur}1a`, color: couleur }}
      >
        {icone}
      </span>
    </div>
  );
}

const ICONES = {
  total: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    </svg>
  ),
  actifs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="m17 11 2 2 4-4" />
    </svg>
  ),
  perdus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M17 12h6" />
    </svg>
  ),
  ca: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M17 6H9a4 4 0 0 0 0 8h6a4 4 0 0 1 0 8H7" />
      <path d="M4 10h9M4 14h7" />
    </svg>
  ),
};

const RAYON_SECTEUR = 40;

/**
 * Onglets du tableau. Un secteur est un vrai cercle de 40 km autour de la
 * ville, calculé à partir du code postal du client — pas un département :
 * Narbonne est à 28 km de Béziers mais dans l'Aude, Montpellier est dans
 * l'Hérault mais à 59 km.
 */
const ONGLETS: { id: string; label: string; statut?: string; centre?: string }[] = [
  { id: "tous", label: "Tous" },
  { id: "attente", label: "En attente de devis", statut: "devis_a_faire" },
  { id: "envoye", label: "Devis envoyé", statut: "devis_envoye" },
  { id: "en_cours", label: "Chantiers en cours", statut: "chantier_en_cours" },
  { id: "termines", label: "Chantiers terminés", statut: "termine" },
  { id: "beziers", label: "Béziers et alentours", centre: "34500" },
  { id: "bordeaux", label: "Bordeaux et alentours", centre: "33000" },
];

export default function AdminClientsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, actifs: 0, perdus: 0, caTotal: 0 });
  const [agences, setAgences] = useState<AgenceLite[]>([]);
  const [tronque, setTronque] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [q, setQ] = useState("");
  const [agence, setAgence] = useState("");
  const [onglet, setOnglet] = useState("tous");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [nouveau, setNouveau] = useState(false);
  const [majStatut, setMajStatut] = useState("");
  const [brouillon, setBrouillon] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    address: "",
    postalCode: "",
    city: "",
    note: "",
  });

  function charger() {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (agence) p.set("agence", agence);
    const o = ONGLETS.find((x) => x.id === onglet);
    if (o?.statut) p.set("statut", o.statut);
    if (o?.centre) {
      p.set("centre", o.centre);
      p.set("rayon", String(RAYON_SECTEUR));
    }
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
        setStats(d.stats ?? { total: 0, actifs: 0, perdus: 0, caTotal: 0 });
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

  // Arrivée depuis « Leads à traiter » : la recherche est déjà remplie.
  useEffect(() => {
    const cherche = new URLSearchParams(window.location.search).get("q");
    if (cherche) setQ(cherche);
  }, []);

  useEffect(() => {
    const t = setTimeout(charger, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, agence, onglet]);

  /**
   * Suivi commercial depuis la liste. La vérité vit dans l'affaire du client :
   * on met à jour l'affichage tout de suite, puis on recharge pour récupérer
   * l'identifiant de l'affaire créée le cas échéant.
   */
  async function changerSuivi(c: Contact, statut: string) {
    if (!statut) return;
    setMajStatut(c.id);
    setContacts((l) => l.map((x) => (x.id === c.id ? { ...x, affaireStatut: statut } : x)));
    const res = await fetch(`/api/admin/contacts/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    });
    setMajStatut("");
    if (res.ok) charger();
    else setContacts((l) => l.map((x) => (x.id === c.id ? { ...x, affaireStatut: c.affaireStatut } : x)));
  }

  async function creer() {
    const res = await fetch("/api/admin/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(brouillon),
    });
    if (res.ok) {
      setNouveau(false);
      setBrouillon({
        firstName: "", lastName: "", phone: "", email: "",
        address: "", postalCode: "", city: "", note: "",
      });
      charger();
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-bold">Clients</h1>
      <p className="mb-5 text-sm text-leaf-800/60">
        Toutes les demandes reçues — appels, formulaires, publicités, réservations.
        {stats.caTotal > 0 && (
          <>
            {" — "}
            <span className="font-semibold text-leaf-700">CA total : {euros(stats.caTotal)}</span>
          </>
        )}
      </p>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tuile label="Total" valeur={String(stats.total)} couleur="#2563eb" icone={ICONES.total} />
        <Tuile label="Actifs" valeur={String(stats.actifs)} couleur="#16a34a" icone={ICONES.actifs} />
        <Tuile label="Perdus" valeur={String(stats.perdus)} couleur="#b91c1c" icone={ICONES.perdus} />
        <Tuile label="CA généré" valeur={euros(stats.caTotal)} couleur="#347030" icone={ICONES.ca} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="input flex-1 !w-auto"
          placeholder="Rechercher un client…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
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
        <button className="btn-primary !w-auto !px-4 !py-2.5 text-sm" onClick={() => setNouveau(true)}>
          + Nouveau client
        </button>
      </div>

      {/* Onglets : les tris du quotidien, à un clic. */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            onClick={() => setOnglet(o.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
              onglet === o.id
                ? "bg-leaf-600 text-white"
                : "bg-white text-leaf-800/70 ring-1 ring-inset ring-leaf-200 hover:bg-leaf-50"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {nouveau && (
        <div className="card mb-4 space-y-2 border-2 border-leaf-300">
          <p className="font-semibold">Nouveau client</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["firstName", "Prénom"],
                ["lastName", "Nom"],
                ["phone", "Téléphone"],
                ["email", "Email"],
              ] as const
            ).map(([champ, libelle]) => (
              <input
                key={champ}
                className="input"
                placeholder={libelle}
                value={brouillon[champ]}
                onChange={(e) => setBrouillon({ ...brouillon, [champ]: e.target.value })}
              />
            ))}
          </div>
          {/* Adresse complète, saisie d'un bloc : le même champ que le tunnel
              de réservation, qui remplit code postal et ville tout seul. */}
          <AddressAutocomplete
            label="Adresse"
            optional
            value={{
              address: brouillon.address,
              postalCode: brouillon.postalCode,
              city: brouillon.city,
            }}
            onChange={(v: AddressValue) => setBrouillon({ ...brouillon, ...v })}
          />
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

      {tronque && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Liste limitée aux 200 plus récents — affinez la recherche.
        </p>
      )}

      {chargement && <p className="py-8 text-center text-leaf-800/60">Chargement…</p>}

      {!chargement && contacts.length === 0 && (
        <div className="card py-8 text-center text-sm text-leaf-800/60">
          {q || agence || onglet !== "tous" ? (
            "Aucun client ne correspond."
          ) : (
            <>
              La base est vide. Si vous aviez déjà des rendez-vous et des prospects, lancez la
              reprise depuis <b>Paramètres → Reprise des données</b> : ils seront regroupés en
              fiches clients.
            </>
          )}
        </div>
      )}

      {!chargement && contacts.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-leaf-100 bg-white">
          <table className="w-full min-w-[62rem] text-sm">
            <thead>
              <tr className="border-b border-leaf-100 text-left text-[11px] uppercase tracking-wider text-leaf-800/50">
                <th className="w-10 px-3 py-3 font-semibold">#</th>
                <th className="whitespace-nowrap px-3 py-3 font-semibold">Nom</th>
                <th className="px-3 py-3 font-semibold">Téléphone</th>
                <th className="px-3 py-3 font-semibold">Email</th>
                <th className="px-3 py-3 font-semibold">Où en est-on ?</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c, i) => {
                const lieu = [c.address, `${c.postalCode} ${c.city}`.trim()].filter(Boolean).join(", ");
                const estOuvert = ouvert === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr
                      onClick={() => setOuvert(estOuvert ? null : c.id)}
                      className={`cursor-pointer border-b border-leaf-100 transition hover:bg-leaf-50 ${
                        estOuvert ? "bg-leaf-50" : ""
                      }`}
                    >
                      <td className="px-3 py-3 tabular-nums text-leaf-800/50">{i + 1}</td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="font-semibold">
                          {`${c.firstName} ${c.lastName}`.trim() || "Sans nom"}
                        </span>
                        {c.perdu && (
                          <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                            Perdu
                          </span>
                        )}
                        {c.agence && (
                          <span
                            className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                            style={{ background: c.agence.couleur }}
                          >
                            {c.agence.nom}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums">{c.phone ? telFr(c.phone) : "—"}</td>
                      <td className="max-w-[13rem] truncate px-3 py-3 text-leaf-800/80" title={c.email}>
                        {c.email || "—"}
                      </td>
                      {/* Le clic sur la ligne ouvre la fiche : il ne doit pas
                          traverser le sélecteur. */}
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={c.affaireStatut}
                          disabled={majStatut === c.id}
                          onChange={(e) => changerSuivi(c, e.target.value)}
                          className={`w-full max-w-[13rem] cursor-pointer rounded-lg border-0 px-2 py-1.5 text-[12px] font-semibold outline-none ring-1 ring-inset ring-leaf-200 focus:ring-leaf-600 disabled:opacity-50 ${
                            SUIVI_SIMPLE.find((o) => o.id === c.affaireStatut)?.couleur ??
                            "bg-white text-leaf-800/60"
                          }`}
                        >
                          <option value="">— à qualifier —</option>
                          {SUIVI_SIMPLE.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                          {/* Étape posée depuis la page Affaires et absente des
                              cinq choix : on l'affiche plutôt que de la perdre. */}
                          {c.affaireStatut && !SUIVI_SIMPLE.some((o) => o.id === c.affaireStatut) && (
                            <option value={c.affaireStatut}>
                              {ETAPE_PAR_ID[c.affaireStatut]?.label ?? c.affaireStatut}
                            </option>
                          )}
                        </select>
                      </td>
                    </tr>
                    {estOuvert && (
                      <tr>
                        <td colSpan={5} className="p-0">
                          <FicheContact id={c.id} agences={agences} onChange={charger} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
