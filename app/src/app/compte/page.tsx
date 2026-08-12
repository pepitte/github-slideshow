"use client";

// Espace particulier : ses rendez-vous, dits clairement (visite de devis ou
// chantier), puis ses coordonnées. Un chantier réservé sur plusieurs jours
// s'affiche en un seul rendez-vous, comme le client l'a vécu en le réservant.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AddressAutocomplete, { type AddressValue } from "@/components/AddressAutocomplete";
import {
  PROJECT_LABELS,
  creneauLabel,
  dateLongue,
  delaiLabel,
  kindMeta,
  statutClient,
  telFr,
} from "@/lib/rdvLabels";

type Booking = {
  id: string;
  kind: string;
  projectType: string;
  description: string;
  startAt: string | null;
  endAt: string | null;
  groupId: string;
  address: string;
  postalCode: string;
  city: string;
  status: string;
  cancelToken: string;
  proPrenom: string;
};
type Client = {
  name: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
};
type Entreprise = { nom: string; telephone: string };

/** Un rendez-vous tel que le client le comprend : un chantier de 3 jours = 1. */
type Rdv = {
  cle: string;
  principal: Booking;
  jours: Booking[];
  debut: string | null;
  fin: string | null;
};

function regrouper(bookings: Booking[]): Rdv[] {
  const paquets = new Map<string, Booking[]>();
  for (const b of bookings) {
    const cle = b.groupId || b.id;
    paquets.set(cle, [...(paquets.get(cle) ?? []), b]);
  }
  return Array.from(paquets.entries())
    .map(([cle, liste]) => {
      const jours = [...liste].sort((a, b) =>
        (a.startAt ?? "").localeCompare(b.startAt ?? "")
      );
      return {
        cle,
        // Le rendez-vous principal porte le lien d'annulation du groupe.
        principal: jours.find((j) => j.id === cle) ?? jours[0],
        jours,
        debut: jours[0].startAt,
        fin: jours[jours.length - 1].startAt,
      };
    })
    .sort((a, b) => (b.debut ?? "").localeCompare(a.debut ?? ""));
}

function Icone({ kind }: { kind: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      {kind === "chantier" ? (
        <>
          <path d="M3 21h18" />
          <path d="M6 21V9l6-4 6 4v12" />
          <path d="M10 21v-6h4v6" />
        </>
      ) : (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 11h18" />
        </>
      )}
    </svg>
  );
}

export default function ClientAccount() {
  const [client, setClient] = useState<Client | null>(null);
  const [entreprise, setEntreprise] = useState<Entreprise>({ nom: "", telephone: "" });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [historique, setHistorique] = useState(false);
  // Fiche « Mes coordonnées » (modifiable)
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [addr, setAddr] = useState<AddressValue>({ address: "", postalCode: "", city: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  function fillForm(c: Client) {
    setName(c.name ?? "");
    setPhone(c.phone ?? "");
    setAddr({
      address: c.address ?? "",
      postalCode: c.postalCode ?? "",
      city: c.city ?? "",
    });
  }

  useEffect(() => {
    fetch("/api/client/me")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/compte/login";
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then((data) => {
        setClient(data.client);
        if (data.client) fillForm(data.client);
        if (data.entreprise) setEntreprise(data.entreprise);
        setBookings(data.bookings ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveProfile() {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/client/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          address: addr.address,
          postalCode: addr.postalCode,
          city: addr.city,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setClient(data.client);
        setEditing(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setSaveError(data.error || "Une erreur est survenue.");
      }
    } catch {
      setSaveError("Erreur réseau, réessayez.");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/client/logout", { method: "POST" });
    window.location.href = "/";
  }

  const now = Date.now();
  const rdvs = useMemo(() => regrouper(bookings), [bookings]);
  // Un devis « sans date » (créé par le gérant) reste dans « À venir », mais en
  // fin de liste : « Votre prochain rendez-vous » doit être un vrai prochain
  // rendez-vous, pas un « Date à définir ».
  const aVenir = rdvs
    .filter(
      (r) =>
        r.principal.status !== "annule" && (!r.fin || new Date(r.fin).getTime() >= now)
    )
    .sort((a, b) => {
      if (!a.debut) return 1;
      if (!b.debut) return -1;
      return a.debut.localeCompare(b.debut); // le plus proche en premier
    });
  const passes = rdvs.filter(
    (r) =>
      r.principal.status === "annule" || (r.fin != null && new Date(r.fin).getTime() < now)
  );
  const prochain = aVenir[0];

  function Carte({ r, vedette }: { r: Rdv; vedette?: boolean }) {
    const b = r.principal;
    const meta = kindMeta(b.kind);
    const passe = r.fin != null && new Date(r.fin).getTime() < now;
    const statut = statutClient(b.kind, b.status, passe);
    const multi = r.jours.length > 1;
    const delai = b.status === "annule" ? "" : delaiLabel(r.debut, now);
    const annulable = b.status !== "annule" && (!r.debut || new Date(r.debut).getTime() >= now);

    // Un rendez-vous annulé garde sa place mais perd sa couleur : on le
    // reconnaît d'un coup d'œil sans le confondre avec un rendez-vous actif.
    const annule = b.status === "annule";
    return (
      <article
        className={`card ${
          annule ? "border-l-4 border-l-leaf-200 opacity-70" : meta.filet
        } ${vedette ? "shadow-md" : ""}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
              annule ? "bg-leaf-100 text-leaf-800/60" : meta.pastille
            }`}
          >
            <Icone kind={b.kind} />
            {multi ? `${meta.titre} · ${r.jours.length} jours` : meta.titre}
          </span>
          <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ${statut.classe}`}>
            {statut.label}
          </span>
        </div>

        <p className="mt-3 text-lg font-bold leading-tight first-letter:uppercase">
          {multi
            ? `Du ${dateLongue(r.debut)} au ${dateLongue(r.fin)}`
            : dateLongue(r.debut)}
        </p>
        {r.debut && (
          <p className="text-sm text-leaf-800/70">
            {multi
              ? "Tous les jours dès 8h00"
              : creneauLabel(b.kind, r.debut, b.endAt)}
            {delai && <span className="font-semibold text-leaf-700"> · {delai}</span>}
          </p>
        )}

        <dl className="mt-3 space-y-1 text-sm text-leaf-800/80">
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-leaf-800/50">Prestation</dt>
            <dd>{PROJECT_LABELS[b.projectType] ?? b.projectType}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-leaf-800/50">Adresse</dt>
            <dd>
              {b.address ? `${b.address}, ` : ""}
              {b.postalCode} {b.city}
            </dd>
          </div>
          {b.proPrenom && b.kind === "chantier" && (
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-leaf-800/50">Paysagiste</dt>
              <dd>{b.proPrenom}</dd>
            </div>
          )}
        </dl>

        {/* Le rappel pratique n'a d'intérêt que sur le rendez-vous mis en avant
            et sur les chantiers (accès au jardin) : ailleurs il se répète. */}
        {!passe && b.status !== "annule" && (vedette || b.kind === "chantier") && (
          <p className="mt-3 rounded-xl bg-leaf-50 px-3 py-2 text-sm text-leaf-800/80">
            {multi ? meta.explication.replace("ce jour-là", "ces jours-là") : meta.explication}
          </p>
        )}

        {(annulable || (r.debut && !passe && b.status !== "annule")) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {r.debut && !passe && b.status !== "annule" && (
              <a href={`/api/rdv/${b.cancelToken}/ics`} className="btn-secondary !py-2 text-sm">
                Ajouter à mon agenda
              </a>
            )}
            {annulable && (
              <Link href={`/annuler/${b.cancelToken}`} className="btn-secondary !py-2 text-sm">
                Modifier ou annuler
              </Link>
            )}
          </div>
        )}
      </article>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-6 sm:max-w-2xl">
      <div className="mb-5 flex items-center justify-between border-b border-leaf-100 pb-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-leaf-800/50">Mon compte</p>
          <h1 className="text-lg font-bold">{client?.name ?? ""}</h1>
        </div>
        <button onClick={logout} className="text-sm text-leaf-800/60 hover:text-leaf-800">
          Déconnexion
        </button>
      </div>

      {loading && <p className="py-8 text-center text-leaf-800/60">Chargement…</p>}

      {!loading && (
        <>
          {prochain ? (
            <section className="mb-6">
              <h2 className="mb-2 text-lg font-bold">Votre prochain rendez-vous</h2>
              <Carte r={prochain} vedette />
            </section>
          ) : (
            <section className="card mb-6 text-center">
              <p className="font-bold">Aucun rendez-vous prévu</p>
              <p className="mt-1 text-sm text-leaf-800/70">
                Réservez une visite gratuite pour recevoir votre devis, ou une journée
                d&apos;intervention si vous savez déjà ce dont vous avez besoin.
              </p>
            </section>
          )}

          <div className="mb-6 flex flex-col gap-2 sm:flex-row">
            <Link href="/#reserver" className="btn-primary flex-1 text-center">
              Demander un devis gratuit
            </Link>
            <Link href="/#chantier" className="btn-secondary flex-1 text-center">
              Rendez-vous chantier
            </Link>
          </div>

          {aVenir.length > 1 && (
            <section className="mb-6">
              <h2 className="mb-3 text-lg font-bold">
                Vos autres rendez-vous ({aVenir.length - 1})
              </h2>
              <div className="space-y-3">
                {aVenir.slice(1).map((r) => (
                  <Carte key={r.cle} r={r} />
                ))}
              </div>
            </section>
          )}

          {passes.length > 0 && (
            <section className="mb-6">
              <button
                onClick={() => setHistorique((v) => !v)}
                className="mb-3 flex w-full items-center justify-between text-lg font-bold"
              >
                Historique ({passes.length})
                <span className="text-sm font-semibold text-leaf-700">
                  {historique ? "Masquer" : "Afficher"}
                </span>
              </button>
              {historique && (
                <div className="space-y-3">
                  {passes.map((r) => (
                    <Carte key={r.cle} r={r} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Coordonnées enregistrées : reprises automatiquement à chaque réservation */}
          <section className="card mb-6">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-bold">Mes coordonnées</h2>
              {!editing && (
                <button
                  onClick={() => {
                    if (client) fillForm(client);
                    setEditing(true);
                  }}
                  className="text-sm font-semibold text-leaf-700 underline"
                >
                  Modifier
                </button>
              )}
            </div>

            {!editing ? (
              <div className="mt-2 space-y-1 text-sm text-leaf-800/80">
                <p>{client?.phone ? telFr(client.phone) : "Téléphone non renseigné"}</p>
                <p>{client?.email}</p>
                {client?.address ? (
                  <p>
                    {client.address}, {client.postalCode} {client.city}
                  </p>
                ) : (
                  <p className="font-medium text-amber-700">
                    Adresse non renseignée — ajoutez-la pour ne plus la ressaisir à chaque
                    réservation.
                  </p>
                )}
                {saved && <p className="font-medium text-leaf-700">✓ Enregistré</p>}
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                <div>
                  <label className="label" htmlFor="c-name">Prénom / nom</label>
                  <input id="c-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="c-phone">Téléphone</label>
                  <input id="c-phone" className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <AddressAutocomplete value={addr} onChange={setAddr} label="Adresse de votre jardin *" />
                <p className="-mt-1 text-xs text-leaf-800/60">
                  Reprise automatiquement à chaque nouvelle réservation.
                </p>
                {saveError && <p className="text-sm text-red-600">{saveError}</p>}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button className="btn-secondary" onClick={() => setEditing(false)}>
                    Annuler
                  </button>
                  <button className="btn-primary" onClick={saveProfile} disabled={saving}>
                    {saving ? "Enregistrement…" : "Enregistrer"}
                  </button>
                </div>
              </div>
            )}
          </section>

          {entreprise.telephone && (
            <p className="pb-4 text-center text-sm text-leaf-800/70">
              Une question ?{" "}
              <a
                href={`tel:${entreprise.telephone.replace(/\s/g, "")}`}
                className="font-semibold text-leaf-700 underline"
              >
                {entreprise.telephone}
              </a>
            </p>
          )}
        </>
      )}
    </main>
  );
}
