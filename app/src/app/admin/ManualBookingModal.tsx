"use client";

// Modale « Ajouter un rendez-vous » : tous les champs sont optionnels (client au
// téléphone, prospect croisé sur un chantier, créneau posé depuis l'agenda…).
// Ouverte depuis l'agenda, elle arrive avec le jour et l'heure déjà remplis.
import { useState } from "react";
import AddressAutocomplete, { type AddressValue } from "@/components/AddressAutocomplete";
import PhotoUpload from "@/components/PhotoUpload";
import { PROJECT_LABELS } from "@/lib/rdvLabels";

export default function ManualBookingModal({
  onClose,
  onCreated,
  defaultDateTime = "",
  defaultKind = "devis",
}: {
  onClose: () => void;
  onCreated: () => void;
  /** « AAAA-MM-JJTHH:mm », tel que l'attend un champ datetime-local. */
  defaultDateTime?: string;
  defaultKind?: "devis" | "chantier";
}) {
  const [kind, setKind] = useState<"devis" | "chantier">(defaultKind);
  const [formule, setFormule] = useState<"demi" | "journee">("journee");
  const [projectType, setProjectType] = useState("autre");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [addr, setAddr] = useState<AddressValue>({ address: "", postalCode: "", city: "" });
  const [description, setDescription] = useState("");
  const [dateTime, setDateTime] = useState(defaultDateTime);
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const [date, time] = dateTime ? dateTime.split("T") : ["", ""];
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          formule,
          projectType,
          firstName,
          lastName,
          phone,
          email,
          address: addr.address,
          postalCode: addr.postalCode,
          city: addr.city,
          description,
          date,
          time,
          photos,
        }),
      });
      const data = await res.json();
      if (res.status === 201) {
        onCreated();
      } else {
        setError(data.error || "Une erreur est survenue.");
      }
    } catch {
      setError("Erreur réseau, réessayez.");
    } finally {
      setBusy(false);
    }
  }

  const onglet = (id: "devis" | "chantier", label: string) => (
    <button
      type="button"
      onClick={() => setKind(id)}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
        kind === id ? "bg-white text-leaf-900 shadow-sm" : "text-leaf-800/60"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <form onSubmit={submit} className="card my-6 w-full max-w-lg space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Ajouter un rendez-vous</h2>
            <p className="text-sm text-leaf-800/60">
              Tous les champs sont facultatifs — notez ce que vous savez.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-xl text-leaf-800/50">
            ✕
          </button>
        </div>

        <div className="flex rounded-xl bg-leaf-50 p-1">
          {onglet("devis", "Visite de devis")}
          {onglet("chantier", "Chantier")}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="m-first">Prénom</label>
            <input id="m-first" className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="m-last">Nom</label>
            <input id="m-last" className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="m-phone">Téléphone</label>
            <input id="m-phone" className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="m-email">Email</label>
            <input id="m-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <AddressAutocomplete value={addr} onChange={setAddr} label="Adresse" optional />
        <div>
          <label className="label" htmlFor="m-prestation">Prestation</label>
          <select
            id="m-prestation"
            className="input"
            value={projectType}
            onChange={(e) => setProjectType(e.target.value)}
          >
            {Object.entries(PROJECT_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="m-notes">Notes</label>
          <textarea
            id="m-notes"
            className="input min-h-[80px]"
            placeholder="Contexte, demande du client, estimation…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="m-date">
            Date et heure {kind === "devis" && "(facultatif)"}
          </label>
          <input
            id="m-date"
            className="input"
            type="datetime-local"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
          />
          {kind === "devis" ? (
            <p className="mt-1 text-xs text-leaf-800/60">
              Laissez vide : le devis restera « sans date » en attendant.
            </p>
          ) : (
            <p className="mt-1 text-xs text-leaf-800/60">
              Sans date, le chantier n&apos;apparaîtra pas dans l&apos;agenda.
            </p>
          )}
        </div>
        {kind === "chantier" && (
          <div>
            <span className="label">Durée</span>
            <div className="mt-1 flex gap-2">
              {(
                [
                  ["demi", "Demi-journée (4 h)"],
                  ["journee", "Journée entière (8 h)"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFormule(id)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    formule === id
                      ? "border-leaf-600 bg-leaf-50 text-leaf-800"
                      : "border-leaf-200 text-leaf-800/60"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        <PhotoUpload photos={photos} onChange={setPhotos} label="Photos (10 max)" maxPhotos={10} />

        {kind === "chantier" && (
          <p className="rounded-xl bg-leaf-50 px-3 py-2 text-sm text-leaf-800/80">
            Un chantier ajouté à la main n&apos;est attribué à personne : il apparaît en orange
            « À attribuer », et vous choisissez le paysagiste depuis sa fiche.
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Annuler
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? "Création…" : "Créer le rendez-vous"}
          </button>
        </div>
      </form>
    </div>
  );
}
