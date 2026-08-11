"use client";

// Détail d'une affaire : montant, date de prochaine action, rendez-vous et
// documents liés. Le reste du dossier client vit dans « Tous les clients ».
import { useEffect, useState } from "react";
import { MOTIFS_PERTE } from "@/lib/pipeline";

type Detail = {
  id: string;
  intitule: string;
  description: string;
  statut: string;
  motifPerte: string;
  montant: number | null;
  prochaineActionAt: string | null;
  address: string;
  postalCode: string;
  city: string;
  contact: { id: string; firstName: string; lastName: string; phone: string; email: string };
  pro: { id: string; name: string } | null;
  bookings: { id: string; kind: string; startAt: string | null; status: string; city: string }[];
  documents: { id: string; type: string; number: string; status: string; date: string }[];
};

function isoJour(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

export default function FicheAffaire({ id, onChange }: { id: string; onChange: () => void }) {
  const [d, setD] = useState<Detail | null>(null);

  useEffect(() => {
    fetch(`/api/admin/affaires/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => res && setD(res.affaire))
      .catch(() => {});
  }, [id]);

  if (!d) return <p className="mt-2 text-xs text-leaf-800/60">Chargement…</p>;

  async function enregistrer(patch: Record<string, unknown>) {
    setD((a) => (a ? { ...a, ...patch } : a));
    await fetch(`/api/admin/affaires/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    onChange();
  }

  return (
    <div className="mt-2 space-y-2 border-t border-leaf-100 pt-2 text-xs">
      <label className="block text-leaf-800/60">
        Intitulé
        <input
          className="input !py-1 text-xs"
          defaultValue={d.intitule}
          onBlur={(e) => enregistrer({ intitule: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-leaf-800/60">
          Montant (€)
          <input
            className="input !py-1 text-xs"
            type="number"
            min={0}
            defaultValue={d.montant ?? ""}
            onBlur={(e) => enregistrer({ montant: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </label>
        <label className="text-leaf-800/60">
          Prochaine action
          <input
            className="input !py-1 text-xs"
            type="date"
            defaultValue={isoJour(d.prochaineActionAt)}
            onBlur={(e) => enregistrer({ prochaineActionAt: e.target.value })}
          />
        </label>
      </div>

      {d.statut === "perdu" && (
        <label className="block text-leaf-800/60">
          Motif de la perte
          <select
            className="input !py-1 text-xs"
            value={d.motifPerte}
            onChange={(e) => enregistrer({ motifPerte: e.target.value })}
          >
            <option value="">— À préciser —</option>
            {Object.entries(MOTIFS_PERTE).map(([id2, label]) => (
              <option key={id2} value={id2}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}

      {d.contact.phone && (
        <p>
          <a className="font-semibold text-leaf-700 underline" href={`tel:${d.contact.phone}`}>
            {d.contact.phone}
          </a>
          {d.city ? ` · ${d.city}` : ""}
        </p>
      )}

      {d.bookings.length > 0 && (
        <div>
          <p className="font-semibold text-leaf-800/60">Rendez-vous</p>
          {d.bookings.map((b) => (
            <p key={b.id} className={b.kind === "chantier" ? "text-green-800" : "text-blue-800"}>
              {b.kind === "chantier" ? "Chantier" : "Visite"} ·{" "}
              {b.startAt
                ? new Date(b.startAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
                : "sans date"}
            </p>
          ))}
        </div>
      )}

      {d.documents.length > 0 && (
        <div>
          <p className="font-semibold text-leaf-800/60">Documents</p>
          {d.documents.map((doc) => (
            <a key={doc.id} className="block text-leaf-700 underline" href={`/admin/facturation/${doc.id}`}>
              {doc.type === "facture" ? "Facture" : "Devis"} {doc.number}
            </a>
          ))}
        </div>
      )}

      <a className="inline-block font-semibold text-leaf-700 underline" href="/admin/clients">
        Voir la fiche client
      </a>
    </div>
  );
}
