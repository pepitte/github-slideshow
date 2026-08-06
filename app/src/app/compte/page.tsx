"use client";

// Espace particulier : liste des rendez-vous (à venir / passés), gestion.
import { useEffect, useState } from "react";
import Link from "next/link";
import AddressAutocomplete, { type AddressValue } from "@/components/AddressAutocomplete";

type Booking = {
  id: string;
  kind: string;
  projectType: string;
  startAt: string;
  address: string;
  postalCode: string;
  city: string;
  status: string;
  cancelToken: string;
};
type Client = {
  name: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
};

const PROJECT_LABELS: Record<string, string> = {
  entretien: "Entretien de jardin général",
  taille_haie: "Taille de haie",
  debroussaillage: "Débroussaillage",
  contrat_annuel: "Contrat d'entretien à l'année",
  autre: "Autre projet",
};
const STATUS_LABELS: Record<string, string> = {
  a_faire: "À venir",
  devis_envoye: "Devis envoyé",
  gagne: "Confirmé",
  perdu: "Clôturé",
  annule: "Annulé",
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ClientAccount() {
  const [client, setClient] = useState<Client | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
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
  const upcoming = bookings.filter((b) => new Date(b.startAt).getTime() >= now && b.status !== "annule");
  const past = bookings.filter((b) => new Date(b.startAt).getTime() < now || b.status === "annule");

  function card(b: Booking) {
    return (
      <div key={b.id} className="card">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold capitalize">{fmt(b.startAt)}</p>
          <span className="rounded-full bg-leaf-100 px-2.5 py-0.5 text-[11px] font-semibold text-leaf-800">
            {b.kind === "chantier" ? "Chantier" : "Devis"}
          </span>
        </div>
        <p className="mt-1 text-sm text-leaf-800/70">
          {PROJECT_LABELS[b.projectType] ?? b.projectType} · {b.city || b.postalCode}
        </p>
        <p className="mt-1 text-sm text-leaf-800/60">{STATUS_LABELS[b.status] ?? b.status}</p>
        {b.status !== "annule" && new Date(b.startAt).getTime() >= now && (
          <Link href={`/annuler/${b.cancelToken}`} className="mt-2 inline-block text-sm font-semibold text-leaf-700 underline">
            Modifier ou annuler
          </Link>
        )}
      </div>
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
          <div className="mb-6 flex flex-col gap-2 sm:flex-row">
            <Link href="/#reserver" className="btn-primary">Réserver un rendez-vous</Link>
          </div>

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
                <p>{client?.phone || "Téléphone non renseigné"}</p>
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

          <h2 className="mb-3 text-lg font-bold">À venir ({upcoming.length})</h2>
          {upcoming.length === 0 ? (
            <p className="card py-6 text-center text-sm text-leaf-800/60">
              Aucun rendez-vous à venir.
            </p>
          ) : (
            <div className="space-y-3">{upcoming.map(card)}</div>
          )}

          {past.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-lg font-bold">Historique</h2>
              <div className="space-y-3">{past.map(card)}</div>
            </>
          )}
        </>
      )}
    </main>
  );
}
