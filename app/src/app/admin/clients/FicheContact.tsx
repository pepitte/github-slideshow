"use client";

// Fiche d'un client : coordonnées modifiables, rendez-vous liés et journal des
// échanges (appels, emails, notes) — l'historique demandé par le gérant.
import { useEffect, useState } from "react";
import { TYPES_INTERACTION } from "@/lib/contactLabels";

type Interaction = {
  id: string;
  createdAt: string;
  type: string;
  sens: string;
  contenu: string;
  auteur: string;
};

type RdvLie = {
  id: string;
  kind: string;
  status: string;
  startAt: string | null;
  city: string;
  projectType: string;
  source: string;
};

type Detail = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  notes: string;
  agenceId: string | null;
  interactions: Interaction[];
  bookings: RdvLie[];
};

const STATUTS: Record<string, string> = {
  a_faire: "À faire",
  devis_envoye: "Devis envoyé",
  gagne: "Gagné",
  perdu: "Perdu",
  annule: "Annulé",
};

function quand(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FicheContact({
  id,
  agences,
  onChange,
}: {
  id: string;
  agences: { id: string; nom: string; couleur: string }[];
  onChange: () => void;
}) {
  const [d, setD] = useState<Detail | null>(null);
  const [message, setMessage] = useState("");
  const [type, setType] = useState("appel");
  const [enregistre, setEnregistre] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/contacts/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => res && setD(res.contact))
      .catch(() => {});
  }, [id]);

  if (!d) return <div className="border-t border-leaf-100 p-3 text-sm text-leaf-800/60">Chargement…</div>;

  async function enregistrer(patch: Record<string, unknown>) {
    setD((c) => (c ? { ...c, ...patch } : c));
    await fetch(`/api/admin/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setEnregistre(true);
    setTimeout(() => setEnregistre(false), 1500);
    onChange();
  }

  async function ajouterEchange() {
    const contenu = message.trim();
    if (!contenu) return;
    const res = await fetch(`/api/admin/contacts/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contenu, type, sens: type === "note" ? "interne" : "entrant" }),
    });
    if (res.ok) {
      const data = await res.json();
      setD((c) => (c ? { ...c, interactions: data.interactions } : c));
      setMessage("");
      onChange();
    }
  }

  return (
    <div className="space-y-4 border-t border-leaf-100 bg-sand-50/40 p-3">
      {enregistre && <p className="text-xs font-semibold text-leaf-700">✓ Enregistré</p>}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-leaf-800/60">
          Téléphone
          <input
            className="input !py-1.5"
            defaultValue={d.phone}
            onBlur={(e) => enregistrer({ phone: e.target.value })}
          />
        </label>
        <label className="text-xs text-leaf-800/60">
          Email
          <input
            className="input !py-1.5"
            defaultValue={d.email}
            onBlur={(e) => enregistrer({ email: e.target.value })}
          />
        </label>
        <label className="text-xs text-leaf-800/60 sm:col-span-2">
          Adresse
          <input
            className="input !py-1.5"
            defaultValue={d.address}
            onBlur={(e) => enregistrer({ address: e.target.value })}
          />
        </label>
        <label className="text-xs text-leaf-800/60">
          Code postal
          <input
            className="input !py-1.5"
            defaultValue={d.postalCode}
            onBlur={(e) => enregistrer({ postalCode: e.target.value })}
          />
        </label>
        <label className="text-xs text-leaf-800/60">
          Ville
          <input
            className="input !py-1.5"
            defaultValue={d.city}
            onBlur={(e) => enregistrer({ city: e.target.value })}
          />
        </label>
        {agences.length > 0 && (
          <label className="text-xs text-leaf-800/60">
            Secteur
            <select
              className="input !py-1.5"
              value={d.agenceId ?? ""}
              onChange={(e) => enregistrer({ agenceId: e.target.value })}
            >
              <option value="">— Non rattaché —</option>
              {agences.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nom}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <label className="block text-xs text-leaf-800/60">
        Notes internes
        <textarea
          className="input"
          rows={2}
          defaultValue={d.notes}
          onBlur={(e) => enregistrer({ notes: e.target.value })}
        />
      </label>

      {d.bookings.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-leaf-800/50">
            Rendez-vous ({d.bookings.length})
          </p>
          <div className="space-y-1">
            {d.bookings.map((b) => (
              <div
                key={b.id}
                className={`rounded-lg px-2.5 py-1.5 text-sm ${
                  b.kind === "chantier" ? "bg-green-50 text-green-900" : "bg-blue-50 text-blue-900"
                }`}
              >
                {b.kind === "chantier" ? "Chantier" : "Visite devis"} ·{" "}
                {b.startAt
                  ? new Date(b.startAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "Sans date"}
                {b.city ? ` · ${b.city}` : ""} — {STATUTS[b.status] ?? b.status}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-leaf-800/50">
          Historique des échanges
        </p>
        <div className="mb-2 flex flex-col gap-2 sm:flex-row">
          <select className="input !w-auto !py-1.5" value={type} onChange={(e) => setType(e.target.value)}>
            {["appel", "email", "sms", "note"].map((t) => (
              <option key={t} value={t}>
                {TYPES_INTERACTION[t]}
              </option>
            ))}
          </select>
          <input
            className="input flex-1 !py-1.5"
            placeholder="Ce qui s'est dit…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ajouterEchange()}
          />
          <button className="btn-secondary !px-3 !py-1.5 text-sm" onClick={ajouterEchange}>
            Ajouter
          </button>
        </div>
        {d.interactions.length === 0 ? (
          <p className="text-sm text-leaf-800/50">Aucun échange enregistré.</p>
        ) : (
          <ul className="space-y-1">
            {d.interactions.map((i) => (
              <li key={i.id} className="rounded-lg bg-white px-2.5 py-1.5 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-leaf-800/50">
                  {TYPES_INTERACTION[i.type] ?? i.type} · {quand(i.createdAt)}
                  {i.auteur ? ` · ${i.auteur}` : ""}
                </span>
                <br />
                <span className="text-leaf-800/90">{i.contenu}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
