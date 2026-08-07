"use client";

// Éditeur de devis / facture : formulaire (client, lignes, TVA, notes) et
// aperçu du document à l'en-tête de l'entreprise. Impression → PDF du navigateur.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type DocItem, euros, itemsOf, totalHt } from "@/lib/documents";

type Doc = {
  id: string;
  type: string;
  number: string;
  date: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  clientPhone: string;
  itemsJson: string;
  vatRate: number;
  notes: string;
  status: string;
};

const COMPANY = {
  name: "Arboris Paysage",
  address: "4 place Barbacane, 34360 Saint-Chinian",
  phone: "06 14 31 00 02",
  siret: "914 126 230 00012",
};

const DEVIS_STATUSES = [
  ["brouillon", "Brouillon"],
  ["envoye", "Envoyé"],
  ["accepte", "Accepté"],
  ["refuse", "Refusé"],
] as const;
const FACTURE_STATUSES = [
  ["a_payer", "À payer"],
  ["payee", "Payée"],
] as const;

export default function DocumentPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [items, setItems] = useState<DocItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/documents/${params.id}`)
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/admin/login";
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then((data) => {
        if (data.document) {
          setDoc(data.document);
          const list = itemsOf(data.document.itemsJson);
          setItems(list.length ? list : [{ label: "", qty: 1, unit: "forfait", unitPrice: 0 }]);
        }
      })
      .catch(() => {});
  }, [params.id]);

  if (!doc) {
    return <main className="px-4 py-10 text-center text-leaf-800/60">Chargement…</main>;
  }

  const set = (patch: Partial<Doc>) => setDoc((d) => (d ? { ...d, ...patch } : d));
  const setItem = (i: number, patch: Partial<DocItem>) =>
    setItems((list) => list.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  const ht = totalHt(items);
  const tva = (ht * doc.vatRate) / 100;
  const ttc = ht + tva;
  const isDevis = doc.type === "devis";

  async function save(): Promise<boolean> {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/documents/${doc!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: doc!.clientName,
          clientAddress: doc!.clientAddress,
          clientEmail: doc!.clientEmail,
          clientPhone: doc!.clientPhone,
          items,
          vatRate: doc!.vatRate,
          notes: doc!.notes,
          date: doc!.date,
          status: doc!.status,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        return true;
      }
      setError("Échec de l'enregistrement, réessayez.");
      return false;
    } catch {
      setError("Erreur réseau, réessayez.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function printDoc() {
    if (await save()) window.print();
  }

  async function toFacture() {
    if (!(await save())) return;
    const res = await fetch("/api/admin/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "facture",
        clientName: doc!.clientName,
        clientAddress: doc!.clientAddress,
        clientEmail: doc!.clientEmail,
        clientPhone: doc!.clientPhone,
        items,
        vatRate: doc!.vatRate,
        notes: doc!.notes,
      }),
    });
    const data = await res.json();
    if (res.status === 201) router.push(`/admin/facturation/${data.document.id}`);
  }

  async function remove() {
    if (!window.confirm(`Supprimer définitivement ${doc!.number} ?`)) return;
    const res = await fetch(`/api/admin/documents/${doc!.id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/facturation");
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      {/* ----- Barre d'actions (masquée à l'impression) ----- */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/admin/facturation" className="text-sm font-semibold text-leaf-700 underline">
            ← Devis &amp; Factures
          </Link>
          <h1 className="text-xl font-bold">{doc.number}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saved && <span className="text-sm font-semibold text-leaf-700">✓ Enregistré</span>}
          {error && <span className="text-sm font-semibold text-red-600">{error}</span>}
          <button className="btn-secondary !px-3 !py-2 text-sm" onClick={save} disabled={saving}>
            {saving ? "…" : "Enregistrer"}
          </button>
          {isDevis && (
            <button className="btn-secondary !px-3 !py-2 text-sm" onClick={toFacture}>
              Transformer en facture
            </button>
          )}
          <button className="btn-primary !w-auto !px-4 !py-2 text-sm" onClick={printDoc}>
            Imprimer / PDF
          </button>
          <button className="!px-2 text-sm text-red-600 underline" onClick={remove}>
            Supprimer
          </button>
        </div>
      </div>

      {/* ----- Formulaire (masqué à l'impression) ----- */}
      <section className="card mb-6 space-y-4 print:hidden">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Nom du client</label>
            <input className="input" value={doc.clientName} onChange={(e) => set({ clientName: e.target.value })} />
          </div>
          <div>
            <label className="label">Adresse du client</label>
            <input className="input" value={doc.clientAddress} onChange={(e) => set({ clientAddress: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={doc.clientEmail} onChange={(e) => set({ clientEmail: e.target.value })} />
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input className="input" type="tel" value={doc.clientPhone} onChange={(e) => set({ clientPhone: e.target.value })} />
          </div>
          <div>
            <label className="label">Date du document</label>
            <input className="input" type="date" value={doc.date} onChange={(e) => set({ date: e.target.value })} />
          </div>
          <div>
            <label className="label">Statut</label>
            <select
              className="input"
              value={doc.status}
              onChange={(e) => set({ status: e.target.value })}
            >
              {(isDevis ? DEVIS_STATUSES : FACTURE_STATUSES).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <span className="label">Prestations</span>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_4.5rem_5.5rem_6.5rem_2rem] items-center gap-2">
                <input
                  className="input !py-2"
                  placeholder="Description (ex. Taille de haie 25 m)"
                  value={it.label}
                  onChange={(e) => setItem(i, { label: e.target.value })}
                />
                <input
                  className="input !py-2"
                  type="number"
                  min={0}
                  step="0.5"
                  title="Quantité"
                  value={it.qty}
                  onChange={(e) => setItem(i, { qty: Number(e.target.value) })}
                />
                <input
                  className="input !py-2"
                  placeholder="unité"
                  title="Unité (forfait, h, m²…)"
                  value={it.unit}
                  onChange={(e) => setItem(i, { unit: e.target.value })}
                />
                <input
                  className="input !py-2"
                  type="number"
                  min={0}
                  step="0.01"
                  title="Prix unitaire HT (€)"
                  value={it.unitPrice}
                  onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) })}
                />
                <button
                  type="button"
                  aria-label="Supprimer la ligne"
                  className="text-leaf-800/40 hover:text-red-600"
                  onClick={() => setItems((list) => list.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn-secondary mt-2 !px-3 !py-1.5 text-xs"
            onClick={() => setItems((list) => [...list, { label: "", qty: 1, unit: "forfait", unitPrice: 0 }])}
          >
            + Ajouter une ligne
          </button>
          <p className="mt-1 text-xs text-leaf-800/50">
            Colonnes : description · quantité · unité · prix unitaire HT (€).
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">TVA</label>
            <select className="input" value={doc.vatRate} onChange={(e) => set({ vatRate: Number(e.target.value) })}>
              <option value={20}>20 %</option>
              <option value={10}>10 %</option>
              <option value={0}>0 % — TVA non applicable (art. 293 B du CGI)</option>
            </select>
          </div>
          <div>
            <label className="label">Notes / conditions</label>
            <textarea
              className="input min-h-[60px]"
              placeholder="Validité du devis, conditions de paiement…"
              value={doc.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* ----- Document imprimable ----- */}
      <section className="card !p-8 print:border-0 print:shadow-none" id="print-doc">
        <div className="flex items-start justify-between gap-4">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt={COMPANY.name} className="h-16 w-auto object-contain" />
            <p className="mt-2 text-sm font-semibold">{COMPANY.name}</p>
            <p className="text-xs text-leaf-800/70">{COMPANY.address}</p>
            <p className="text-xs text-leaf-800/70">{COMPANY.phone}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-extrabold uppercase">{isDevis ? "Devis" : "Facture"}</p>
            <p className="text-sm font-semibold">{doc.number}</p>
            <p className="text-sm text-leaf-800/70">
              {new Date(`${doc.date}T12:00:00`).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-sand-50 p-4 text-sm print:bg-transparent print:p-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-leaf-800/50">Client</p>
          <p className="font-semibold">{doc.clientName || "—"}</p>
          {doc.clientAddress && <p>{doc.clientAddress}</p>}
          {(doc.clientPhone || doc.clientEmail) && (
            <p className="text-leaf-800/70">{[doc.clientPhone, doc.clientEmail].filter(Boolean).join(" · ")}</p>
          )}
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-leaf-200 text-left text-xs uppercase tracking-wide text-leaf-800/50">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Qté</th>
              <th className="py-2 text-right">PU HT</th>
              <th className="py-2 text-right">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {items.filter((it) => it.label || it.unitPrice).map((it, i) => (
              <tr key={i} className="border-b border-leaf-100">
                <td className="py-2">{it.label}</td>
                <td className="py-2 text-right">
                  {it.qty}{it.unit ? ` ${it.unit}` : ""}
                </td>
                <td className="py-2 text-right">{euros(it.unitPrice)}</td>
                <td className="py-2 text-right font-semibold">{euros(it.qty * it.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-56 space-y-1 text-sm">
          <p className="flex justify-between"><span>Total HT</span><span className="font-semibold">{euros(ht)}</span></p>
          <p className="flex justify-between">
            <span>TVA {doc.vatRate} %</span>
            <span className="font-semibold">{euros(tva)}</span>
          </p>
          <p className="flex justify-between border-t border-leaf-200 pt-1 text-base font-extrabold">
            <span>Total TTC</span><span>{euros(ttc)}</span>
          </p>
        </div>

        {doc.vatRate === 0 && (
          <p className="mt-3 text-xs text-leaf-800/60">TVA non applicable, article 293 B du CGI.</p>
        )}
        {doc.notes && <p className="mt-4 whitespace-pre-line rounded-xl bg-sand-50 p-3 text-sm print:bg-transparent print:p-0">{doc.notes}</p>}

        <p className="mt-8 border-t border-leaf-100 pt-3 text-center text-[11px] text-leaf-800/50">
          {COMPANY.name} — SIRET {COMPANY.siret} — {COMPANY.address} — {COMPANY.phone}
        </p>
      </section>
    </main>
  );
}
