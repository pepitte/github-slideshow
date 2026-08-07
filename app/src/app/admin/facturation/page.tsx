"use client";

// Facturation : liste des devis chiffrés et des factures, création en un clic.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { itemsOf, totalHt, euros } from "@/lib/documents";

type Doc = {
  id: string;
  type: string;
  number: string;
  date: string;
  clientName: string;
  itemsJson: string;
  vatRate: number;
  status: string;
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  brouillon: { label: "Brouillon", cls: "bg-gray-100 text-gray-600" },
  envoye: { label: "Envoyé", cls: "bg-blue-100 text-blue-800" },
  accepte: { label: "Accepté", cls: "bg-leaf-100 text-leaf-800" },
  refuse: { label: "Refusé", cls: "bg-red-100 text-red-700" },
  a_payer: { label: "À payer", cls: "bg-amber-100 text-amber-800" },
  payee: { label: "Payée", cls: "bg-leaf-100 text-leaf-800" },
};

function totalTtc(itemsJson: string, vatRate: number): number {
  return totalHt(itemsOf(itemsJson)) * (1 + vatRate / 100);
}

export default function FacturationPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"devis" | "facture">("devis");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/admin/documents")
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/admin/login";
          throw new Error("unauthorized");
        }
        return r.json();
      })
      .then((data) => setDocs(data.documents ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function createDoc() {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: tab }),
      });
      const data = await res.json();
      if (res.status === 201) router.push(`/admin/facturation/${data.document.id}`);
    } finally {
      setCreating(false);
    }
  }

  const visible = docs.filter((d) => d.type === tab);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Devis &amp; Factures</h1>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl bg-leaf-50 p-1">
            {([["devis", "Devis"], ["facture", "Factures"]] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                  tab === id ? "bg-white text-leaf-800 shadow-sm" : "text-leaf-800/60"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="btn-primary !w-auto !px-4 !py-2.5 text-sm" onClick={createDoc} disabled={creating}>
            {creating ? "Création…" : tab === "devis" ? "Nouveau devis" : "Nouvelle facture"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-leaf-800/60">Chargement…</p>
      ) : visible.length === 0 ? (
        <p className="card py-10 text-center text-sm text-leaf-800/60">
          Aucun{tab === "facture" ? "e facture" : " devis"} pour le moment — créez
          {tab === "facture" ? " la première" : " le premier"} avec le bouton ci-dessus.
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((d) => {
            const st = STATUS_LABELS[d.status] ?? STATUS_LABELS.brouillon;
            return (
              <Link
                key={d.id}
                href={`/admin/facturation/${d.id}`}
                className="card flex items-center justify-between gap-3 py-3 transition hover:border-leaf-300"
              >
                <div>
                  <p className="font-semibold">
                    {d.number}
                    {d.clientName ? ` — ${d.clientName}` : ""}
                  </p>
                  <p className="text-sm text-leaf-800/60">
                    {new Date(`${d.date}T12:00:00`).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">{euros(totalTtc(d.itemsJson, d.vatRate))}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
