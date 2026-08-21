"use client";

// Tableau de bord : la vue d'ensemble. Trois chiffres du moment, l'évolution du
// chiffre d'affaires, les demandes que personne n'a encore traitées et les
// prochains rendez-vous. La liste de travail complète est sur /admin/rendez-vous.
import { useEffect, useState } from "react";
import Link from "next/link";
import { ORIGINES } from "@/lib/contactLabels";

type Tuiles = {
  nouveauxCeMois: number;
  nouveauxMoisPrec: number;
  evolution: number | null;
  caMois: number;
  chantiersSemaine: number;
};
type Mois = { mois: string; ca: number };
type ATraiter = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  origine: string;
  city: string;
  createdAt: string;
  /** Ce que le prospect demande, en une ligne. */
  demande: string;
  /** Date du dernier essai d'appel, si marqué « à recontacter ». */
  relanceAt: string | null;
  /** Date du marquage « déjà contacté ». */
  contacteAt: string | null;
  jours: number;
};
type Prochain = {
  id: string;
  kind: string;
  firstName: string;
  lastName: string;
  city: string;
  startAt: string | null;
  endAt: string | null;
  pro: { id: string; name: string } | null;
};

function euros(n: number): string {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}
function moisCourt(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const l = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("fr-FR", {
    month: "long",
    timeZone: "UTC",
  });
  return l.charAt(0).toUpperCase() + l.slice(1);
}
function initiales(prenom: string, nom: string): string {
  const a = (prenom || "").trim()[0] ?? "";
  const b = (nom || "").trim()[0] ?? "";
  return (a + b).toUpperCase() || "?";
}
function heure(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso)
    .toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })
    .replace(":", "h");
}
function jourCourt(iso: string | null): string {
  if (!iso) return "Sans date";
  const l = new Date(iso).toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return l.charAt(0).toUpperCase() + l.slice(1);
}
function dateHeure(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Étiquette courte de l'origine, pour la pastille de la liste des leads. Les
 * libellés tiennent en un mot : au-delà, la pastille passe à la ligne et casse
 * le rythme à deux lignes de chaque entrée.
 */
const ORIGINE_COURTE: Record<string, { court: string; classe: string }> = {
  meta: { court: "PUB", classe: "bg-violet-100 text-violet-700" },
  web: { court: "EN LIGNE", classe: "bg-blue-100 text-blue-700" },
  site: { court: "SITE", classe: "bg-leaf-100 text-leaf-800" },
  phone: { court: "APPEL", classe: "bg-amber-100 text-amber-800" },
  manual: { court: "SAISI", classe: "bg-sand-50 text-leaf-800/70" },
  recommandation: { court: "RECO", classe: "bg-sand-50 text-leaf-800/70" },
};

/** Tuile de synthèse : le chiffre d'abord, la comparaison ensuite. */
function Tuile({
  label,
  valeur,
  aide,
  aideCouleur,
  icone,
}: {
  label: string;
  valeur: string;
  aide: string;
  aideCouleur?: string;
  icone: React.ReactNode;
}) {
  return (
    <div className="card !p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-leaf-800/50">{label}</p>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-leaf-50 text-leaf-700">
          {icone}
        </span>
      </div>
      <p className="mt-2 text-3xl font-bold text-leaf-900">{valeur}</p>
      <p className={`mt-1 text-sm ${aideCouleur ?? "text-leaf-800/60"}`}>{aide}</p>
    </div>
  );
}

const ICONES = {
  clients: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    </svg>
  ),
  euro: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M17 6H9a4 4 0 0 0 0 8h6a4 4 0 0 1 0 8H7" />
      <path d="M4 10h9M4 14h7" />
    </svg>
  ),
  agenda: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
};

/** Courbe du chiffre d'affaires, en SVG pur (aucune librairie). */
function Courbe({ mois }: { mois: Mois[] }) {
  const L = 640;
  const H = 220;
  const padG = 52;
  const padB = 26;
  const max = Math.max(1, ...mois.map((m) => m.ca));
  // Palier lisible : on arrondit au multiple supérieur de 8 000 €.
  const pas = Math.max(2000, Math.ceil(max / 4 / 1000) * 1000);
  const haut = pas * 4;
  const x = (i: number) => padG + (i * (L - padG - 12)) / Math.max(1, mois.length - 1);
  const y = (v: number) => H - padB - (v / haut) * (H - padB - 14);

  const pts = mois.map((m, i) => [x(i), y(m.ca)] as const);
  // Lissage : un point de contrôle à mi-chemin entre deux mesures.
  let ligne = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const mx = (px + cx) / 2;
    ligne += ` C ${mx} ${py}, ${mx} ${cy}, ${cx} ${cy}`;
  }
  const aire = `${ligne} L ${pts[pts.length - 1][0]} ${H - padB} L ${pts[0][0]} ${H - padB} Z`;

  return (
    <svg viewBox={`0 0 ${L} ${H}`} className="w-full" role="img" aria-label="Évolution du chiffre d'affaires">
      <defs>
        <linearGradient id="degradeCa" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16a34a" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#16a34a" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map((i) => {
        const v = pas * i;
        return (
          <g key={i}>
            <line
              x1={padG}
              x2={L - 12}
              y1={y(v)}
              y2={y(v)}
              stroke="#d7e0d5"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
            <text x={padG - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#7c8a7c">
              {v === 0 ? "0 €" : `${Math.round(v / 1000)}k €`}
            </text>
          </g>
        );
      })}
      <path d={aire} fill="url(#degradeCa)" />
      <path d={ligne} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" />
      {pts.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="3.5" fill="#fff" stroke="#16a34a" strokeWidth="2">
          <title>{`${moisCourt(mois[i].mois)} : ${euros(mois[i].ca)}`}</title>
        </circle>
      ))}
      {mois.map((m, i) => (
        <text key={m.mois} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="#7c8a7c">
          {moisCourt(m.mois).slice(0, 4)}
        </text>
      ))}
    </svg>
  );
}

export default function AdminDashboard() {
  const [tuiles, setTuiles] = useState<Tuiles | null>(null);
  const [mois, setMois] = useState<Mois[]>([]);
  const [aTraiter, setATraiter] = useState<ATraiter[]>([]);
  const [aTraiterTotal, setATraiterTotal] = useState(0);
  const [enCours, setEnCours] = useState("");
  const [prochains, setProchains] = useState<Prochain[]>([]);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/admin/login";
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then((d) => {
        setTuiles(d.tuiles ?? null);
        setMois(d.mois ?? []);
        setATraiter(d.aTraiter ?? []);
        setATraiterTotal(d.aTraiterTotal ?? (d.aTraiter ?? []).length);
        setProchains(d.prochains ?? []);
      })
      .catch(() => {});
  }, []);

  /**
   * Suivi d'un lead. « Déjà contacté » le sort de la liste ; « à recontacter »
   * l'y laisse — c'est encore à faire — mais garde la date du dernier essai.
   * Dans les deux cas la fiche client est intacte : rien n'est supprimé.
   */
  async function suivre(c: ATraiter, geste: "contacte" | "relance") {
    // Recliquer sur un bouton déjà actif annule le marquage : une erreur de
    // clic se répare sans passer par la fiche du client.
    const actif = geste === "contacte" ? Boolean(c.contacteAt) : Boolean(c.relanceAt);
    const valeur = !actif;
    setEnCours(c.id);
    const res = await fetch(`/api/admin/contacts/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geste === "contacte" ? { contacte: valeur } : { relance: valeur }),
    });
    setEnCours("");
    if (!res.ok) return;
    const quand = valeur ? new Date().toISOString() : null;
    setATraiter((l) =>
      l.map((x) =>
        x.id !== c.id
          ? x
          : geste === "contacte"
            ? // « Déjà contacté » clôt aussi une relance en attente.
              { ...x, contacteAt: quand, relanceAt: valeur ? null : x.relanceAt }
            : { ...x, relanceAt: quand }
      )
    );
    if (geste === "contacte") setATraiterTotal((n) => Math.max(0, valeur ? n - 1 : n + 1));
  }

  if (!tuiles) {
    return <main className="mx-auto max-w-6xl px-4 py-10 text-center text-leaf-800/60">Chargement…</main>;
  }

  const evo = tuiles.evolution;
  const aideLeads =
    evo === null
      ? tuiles.nouveauxMoisPrec === 0 && tuiles.nouveauxCeMois === 0
        ? "Aucune demande ce mois-ci"
        : "Premier mois de mesure"
      : `${evo > 0 ? "+" : ""}${evo} % vs mois préc.`;
  const couleurEvo =
    evo === null ? undefined : evo >= 0 ? "text-leaf-700 font-semibold" : "text-red-600 font-semibold";

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>
      <p className="mb-5 text-sm text-leaf-800/60">Vue d&apos;ensemble de votre activité</p>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <Tuile
          label="Nouveaux clients ce mois"
          valeur={String(tuiles.nouveauxCeMois)}
          aide={aideLeads}
          aideCouleur={couleurEvo}
          icone={ICONES.clients}
        />
        <Tuile
          label="Chiffre d'affaires"
          valeur={euros(tuiles.caMois)}
          aide="Facturé ce mois-ci"
          icone={ICONES.euro}
        />
        <Tuile
          label="Chantiers planifiés"
          valeur={String(tuiles.chantiersSemaine)}
          aide="Cette semaine"
          icone={ICONES.agenda}
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="font-bold">Évolution du chiffre d&apos;affaires</h2>
          <p className="mb-3 text-sm text-leaf-800/60">Vos revenus facturés des 6 derniers mois</p>
          {mois.every((m) => m.ca === 0) ? (
            <p className="py-10 text-center text-sm text-leaf-800/50">
              Aucune facture émise sur la période. Les montants apparaîtront ici dès vos premières
              factures (section <b>Devis &amp; Factures</b>).
            </p>
          ) : (
            <Courbe mois={mois} />
          )}
        </section>

        <section className="card">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-bold">
              Leads à traiter
              {aTraiterTotal > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                  {aTraiterTotal}
                </span>
              )}
            </h2>
            <Link href="/admin/clients" className="text-sm font-semibold text-leaf-700 hover:underline">
              Voir tout
            </Link>
          </div>
          <p className="text-sm text-leaf-800/60">
            Les plus récents d'abord, sans rendez-vous ni devis. Les lignes
            vertes sont faites, elles disparaissent au bout de 24 h.
          </p>

          {aTraiter.length === 0 ? (
            <p className="py-8 text-center text-sm text-leaf-800/50">
              Rien en attente — toutes les demandes reçues ont été prises en main.
            </p>
          ) : (
            <ul className="-mx-2 mt-2">
              {aTraiter.map((c) => {
                const o = ORIGINE_COURTE[c.origine] ?? {
                  court: (ORIGINES[c.origine] ?? c.origine).toUpperCase(),
                  classe: "bg-sand-50 text-leaf-800/70",
                };
                const nom = `${c.firstName} ${c.lastName}`.trim() || "Sans nom";
                // Coup d'œil : la ligne entière prend la couleur de son état.
                const fond = c.contacteAt
                  ? "bg-leaf-50/70"
                  : c.relanceAt
                    ? "bg-amber-50/60"
                    : "";
                return (
                  <li key={c.id} className={`border-b border-leaf-50 last:border-0 ${fond}`}>
                    {/* La recherche par téléphone retrouve la fiche même très
                        ancienne : la liste des clients ne charge que les
                        derniers, un lien par identifiant tomberait à vide. */}
                    <Link
                      href={`/admin/clients?q=${encodeURIComponent(c.phone || nom)}`}
                      className="flex items-center gap-3 rounded-xl px-2 pb-1 pt-2.5 transition hover:bg-leaf-50"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-leaf-100 bg-white text-xs font-bold text-leaf-800/70">
                        {initiales(c.firstName, c.lastName)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-leaf-900">{nom}</span>
                          <span className={`shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold ${o.classe}`}>
                            {o.court}
                          </span>
                        </span>
                        <span className="block truncate text-xs text-leaf-800/60">
                          {c.demande || "Aucune précision"}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span
                          className={`block text-xs font-bold ${
                            c.jours >= 7
                              ? "text-red-600"
                              : c.jours === 0
                                ? "text-leaf-700"
                                : "text-amber-600"
                          }`}
                        >
                          {c.jours === 0
                            ? "aujourd'hui"
                            : `${c.jours} jour${c.jours > 1 ? "s" : ""}`}
                        </span>
                        <span className="block text-[11px] tabular-nums text-leaf-800/50">
                          {dateHeure(c.createdAt)}
                        </span>
                      </span>
                    </Link>
                    {/* Hors du lien : un clic ici ne doit pas ouvrir la fiche. */}
                    <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2.5 pl-[3.25rem]">
                      <button
                        onClick={() => suivre(c, "contacte")}
                        disabled={enCours === c.id}
                        title={c.contacteAt ? "Annuler ce marquage" : "Marquer comme déjà contacté"}
                        className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition disabled:opacity-40 ${
                          c.contacteAt
                            ? "border-leaf-600 bg-leaf-600 text-white"
                            : "border-leaf-200 text-leaf-800 hover:border-leaf-600 hover:bg-leaf-50"
                        }`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                          <path d="m4 12 5 5L20 6" />
                        </svg>
                        Déjà contacté
                      </button>
                      <button
                        onClick={() => suivre(c, "relance")}
                        disabled={enCours === c.id}
                        title={c.relanceAt ? "Annuler ce marquage" : "Marquer comme à recontacter"}
                        className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition disabled:opacity-40 ${
                          c.relanceAt
                            ? "border-amber-500 bg-amber-500 text-white"
                            : "border-leaf-200 text-leaf-800 hover:border-amber-400 hover:bg-amber-50"
                        }`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
                          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                          <path d="M3 3v5h5" />
                        </svg>
                        À recontacter
                      </button>
                      {c.contacteAt ? (
                        <span className="text-[11px] font-semibold text-leaf-700">
                          contacté le {dateHeure(c.contacteAt)}
                        </span>
                      ) : c.relanceAt ? (
                        <span className="text-[11px] text-amber-700">
                          essai du {dateHeure(c.relanceAt)}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">Prochains rendez-vous</h2>
          <Link href="/admin/rendez-vous" className="text-sm font-semibold text-leaf-700 underline">
            Tout voir
          </Link>
        </div>
        {prochains.length === 0 ? (
          <p className="py-6 text-center text-sm text-leaf-800/50">Aucun rendez-vous à venir.</p>
        ) : (
          <ul className="mt-2 divide-y divide-leaf-100">
            {prochains.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    b.kind === "chantier" ? "bg-green-500" : "bg-blue-500"
                  }`}
                />
                <span className="font-semibold">{jourCourt(b.startAt)}</span>
                <span className="tabular-nums text-leaf-800/70">{heure(b.startAt)}</span>
                <span className="truncate">
                  {`${b.firstName} ${b.lastName}`.trim() || "Sans nom"}
                </span>
                {b.city && <span className="text-leaf-800/60">{b.city}</span>}
                <span className="ml-auto text-xs text-leaf-800/60">
                  {b.pro ? b.pro.name : b.kind === "chantier" ? "À attribuer" : "Vous"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
