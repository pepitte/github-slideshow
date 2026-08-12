"use client";

// Reprise des données : deux opérations à faire une seule fois, au démarrage.
// Elles vivent ici plutôt que dans les écrans de travail quotidiens, qu'elles
// encombraient. Relançables sans risque : elles ne créent aucun doublon.
import { useState } from "react";

export default function RepriseSection() {
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState("");

  async function lancer(cle: string, url: string, question: string) {
    if (!window.confirm(`${question}\n\nL'opération peut être relancée sans risque : elle ne crée pas de doublon.`))
      return;
    setEnCours(cle);
    setMessages((m) => ({ ...m, [cle]: "" }));
    const res = await fetch(url, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setEnCours("");
    setMessages((m) => ({ ...m, [cle]: d.message ?? d.error ?? "Reprise impossible." }));
  }

  return (
    <section className="card space-y-3">
      <h2 className="font-bold">Reprise des données</h2>
      <p className="text-sm text-leaf-800/70">
        À lancer une fois, au démarrage : vos rendez-vous, prospects et comptes déjà enregistrés
        sont regroupés en fiches clients, puis en affaires. Dans cet ordre.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <button
            className="btn-secondary w-full !py-2.5 text-sm"
            disabled={enCours !== ""}
            onClick={() =>
              lancer(
                "clients",
                "/api/admin/contacts/reprise",
                "1. Remplir la base « Tous les clients » à partir des rendez-vous, prospects et comptes existants ?"
              )
            }
          >
            {enCours === "clients" ? "Reprise…" : "1. Remplir la base clients"}
          </button>
          {messages.clients && (
            <p className="mt-2 rounded-xl bg-leaf-50 px-3 py-2 text-sm text-leaf-800">{messages.clients}</p>
          )}
        </div>

        <div>
          <button
            className="btn-secondary w-full !py-2.5 text-sm"
            disabled={enCours !== ""}
            onClick={() =>
              lancer(
                "affaires",
                "/api/admin/affaires/reprise",
                "2. Créer les affaires à partir des rendez-vous existants ?"
              )
            }
          >
            {enCours === "affaires" ? "Reprise…" : "2. Créer les affaires"}
          </button>
          {messages.affaires && (
            <p className="mt-2 rounded-xl bg-leaf-50 px-3 py-2 text-sm text-leaf-800">{messages.affaires}</p>
          )}
        </div>
      </div>
    </section>
  );
}
