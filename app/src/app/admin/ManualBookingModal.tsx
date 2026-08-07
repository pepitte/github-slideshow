"use client";

// Modale « Ajouter un devis manuellement » : tous les champs sont optionnels
// (client au téléphone, prospect croisé sur un chantier…).
import { useState } from "react";
import AddressAutocomplete, { type AddressValue } from "@/components/AddressAutocomplete";
import PhotoUpload from "@/components/PhotoUpload";

export default function ManualBookingModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [addr, setAddr] = useState<AddressValue>({ address: "", postalCode: "", city: "" });
  const [description, setDescription] = useState("");
  const [dateTime, setDateTime] = useState("");
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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <form onSubmit={submit} className="card my-6 w-full max-w-lg space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Ajouter un devis manuellement</h2>
            <p className="text-sm text-leaf-800/60">
              Tous les champs sont facultatifs — notez ce que vous savez.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-xl text-leaf-800/50">
            ✕
          </button>
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
          <label className="label" htmlFor="m-date">Rendez-vous (facultatif)</label>
          <input
            id="m-date"
            className="input"
            type="datetime-local"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
          />
          <p className="mt-1 text-xs text-leaf-800/60">
            Laissez vide : le devis restera « sans date » en attendant.
          </p>
        </div>
        <PhotoUpload photos={photos} onChange={setPhotos} label="Photos (10 max)" maxPhotos={10} />

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Annuler
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? "Création…" : "Créer le devis"}
          </button>
        </div>
      </form>
    </div>
  );
}
