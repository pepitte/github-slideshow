"use client";

// Secteurs d'exploitation (Bordeaux, Béziers…). Dès qu'un secteur existe, c'est
// lui qui définit la zone d'intervention : un client est accepté s'il est
// couvert par AU MOINS UN secteur. C'est ce qui permet d'exploiter deux villes
// éloignées sans que l'une exclue l'autre.
import { useEffect, useState } from "react";

type Agence = {
  id: string;
  nom: string;
  couleur: string;
  address: string;
  postalCode: string;
  city: string;
  radiusKm: number;
  postalCodesJson: string;
  actif: boolean;
  prosCount: number;
};

const COULEURS = ["#347030", "#2563eb", "#b45309", "#7c3aed", "#be123c", "#0f766e"];

function codesDe(json: string): string {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.join(", ") : "";
  } catch {
    return "";
  }
}

export default function AgencesSection() {
  const [agences, setAgences] = useState<Agence[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [nouveau, setNouveau] = useState(false);
  const [brouillon, setBrouillon] = useState({
    nom: "",
    postalCode: "",
    city: "",
    address: "",
    radiusKm: 30,
    postalCodes: "",
    couleur: COULEURS[0],
  });

  function charger() {
    fetch("/api/admin/agences")
      .then((r) => (r.ok ? r.json() : { agences: [] }))
      .then((d) => setAgences(d.agences ?? []))
      .finally(() => setChargement(false));
  }
  useEffect(charger, []);

  async function creer() {
    setErreur("");
    const res = await fetch("/api/admin/agences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(brouillon),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErreur(d.error ?? "Création impossible.");
      return;
    }
    setNouveau(false);
    setBrouillon({
      nom: "",
      postalCode: "",
      city: "",
      address: "",
      radiusKm: 30,
      postalCodes: "",
      couleur: COULEURS[agences.length % COULEURS.length],
    });
    charger();
  }

  async function modifier(id: string, patch: Record<string, unknown>) {
    setAgences((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    await fetch(`/api/admin/agences/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function supprimer(a: Agence) {
    const suite =
      a.prosCount > 0
        ? `\n${a.prosCount} paysagiste(s) y sont rattachés : ils ne seront pas supprimés, seulement détachés.`
        : "";
    if (!window.confirm(`Supprimer le secteur « ${a.nom} » ?${suite}`)) return;
    const res = await fetch(`/api/admin/agences/${a.id}`, { method: "DELETE" });
    if (res.ok) setAgences((list) => list.filter((x) => x.id !== a.id));
  }

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Secteurs d&apos;intervention</h2>
        {!nouveau && (
          <button className="btn-secondary !px-3 !py-1.5 text-sm" onClick={() => setNouveau(true)}>
            Ajouter un secteur
          </button>
        )}
      </div>

      <p className="text-sm text-leaf-800/70">
        Un secteur = une ville et son rayon d&apos;action (Bordeaux, Béziers…). Dès qu&apos;un
        secteur existe, un client est accepté s&apos;il est couvert par <b>au moins un</b> secteur —
        la zone unique ci-dessous n&apos;est alors plus utilisée.
      </p>

      {chargement && <p className="text-sm text-leaf-800/60">Chargement…</p>}

      {!chargement && agences.length === 0 && !nouveau && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Aucun secteur. L&apos;application utilise la zone unique définie plus bas — elle ne
          couvre qu&apos;une seule région. <b>Pour travailler sur deux villes éloignées, créez un
          secteur par ville.</b>
        </p>
      )}

      <div className="space-y-2">
        {agences.map((a) => (
          <div key={a.id} className="rounded-xl border border-leaf-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: a.couleur }} />
              <input
                className="input !w-auto flex-1 !py-1.5 font-semibold"
                value={a.nom}
                onChange={(e) => modifier(a.id, { nom: e.target.value })}
              />
              <span className="text-xs text-leaf-800/60">
                {a.prosCount} paysagiste{a.prosCount > 1 ? "s" : ""}
              </span>
              <label className="flex items-center gap-1.5 text-xs text-leaf-800/70">
                <input
                  type="checkbox"
                  checked={a.actif}
                  onChange={(e) => modifier(a.id, { actif: e.target.checked })}
                />
                Actif
              </label>
              <button onClick={() => supprimer(a)} className="text-xs text-red-600 underline">
                Supprimer
              </button>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <label className="text-xs text-leaf-800/60">
                Code postal du secteur
                <input
                  className="input !py-1.5"
                  value={a.postalCode}
                  onChange={(e) => modifier(a.id, { postalCode: e.target.value })}
                  placeholder="33000"
                />
              </label>
              <label className="text-xs text-leaf-800/60">
                Rayon (km)
                <input
                  className="input !py-1.5"
                  type="number"
                  min={0}
                  max={300}
                  value={a.radiusKm}
                  onChange={(e) => modifier(a.id, { radiusKm: Number(e.target.value) })}
                />
              </label>
              <label className="text-xs text-leaf-800/60">
                Départements ou codes postaux
                <input
                  className="input !py-1.5"
                  defaultValue={codesDe(a.postalCodesJson)}
                  onBlur={(e) => modifier(a.id, { postalCodes: e.target.value })}
                  placeholder="33, 40"
                />
              </label>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-leaf-800/60">Couleur dans l&apos;agenda :</span>
              {COULEURS.map((c) => (
                <button
                  key={c}
                  aria-label={`Couleur ${c}`}
                  onClick={() => modifier(a.id, { couleur: c })}
                  className={`h-5 w-5 rounded-full border-2 ${
                    a.couleur === c ? "border-leaf-900" : "border-transparent"
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {nouveau && (
        <div className="rounded-xl border-2 border-leaf-300 bg-leaf-50/40 p-3">
          <p className="mb-2 font-semibold">Nouveau secteur</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-leaf-800/60">
              Nom
              <input
                className="input !py-1.5"
                placeholder="Bordeaux"
                value={brouillon.nom}
                onChange={(e) => setBrouillon({ ...brouillon, nom: e.target.value })}
              />
            </label>
            <label className="text-xs text-leaf-800/60">
              Code postal
              <input
                className="input !py-1.5"
                placeholder="33000"
                value={brouillon.postalCode}
                onChange={(e) => setBrouillon({ ...brouillon, postalCode: e.target.value })}
              />
            </label>
            <label className="text-xs text-leaf-800/60">
              Rayon (km)
              <input
                className="input !py-1.5"
                type="number"
                min={0}
                max={300}
                value={brouillon.radiusKm}
                onChange={(e) => setBrouillon({ ...brouillon, radiusKm: Number(e.target.value) })}
              />
            </label>
            <label className="text-xs text-leaf-800/60">
              Départements ou codes postaux (facultatif)
              <input
                className="input !py-1.5"
                placeholder="33, 40"
                value={brouillon.postalCodes}
                onChange={(e) => setBrouillon({ ...brouillon, postalCodes: e.target.value })}
              />
            </label>
          </div>
          {erreur && <p className="mt-2 text-sm font-semibold text-red-600">{erreur}</p>}
          <div className="mt-3 flex gap-2">
            <button className="btn-primary !w-auto !px-4 !py-2 text-sm" onClick={creer}>
              Créer le secteur
            </button>
            <button
              className="btn-secondary !px-4 !py-2 text-sm"
              onClick={() => {
                setNouveau(false);
                setErreur("");
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
