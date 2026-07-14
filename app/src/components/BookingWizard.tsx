"use client";

// Tunnel de réservation mobile-first en 3 étapes — objectif < 60 secondes.
// 1. Projet  2. Coordonnées + adresse (contrôle de zone)  3. Créneau → confirmation.
import { useState } from "react";
import { useRouter } from "next/navigation";
import AddressAutocomplete, { type AddressValue } from "./AddressAutocomplete";
import PhotoUpload from "./PhotoUpload";
import SlotPicker from "./SlotPicker";
import { trackMetaEvent } from "./MetaPixel";

const PROJECT_TYPES = [
  { id: "entretien", label: "Entretien de jardin général" },
  { id: "taille_haie", label: "Taille de haie" },
  { id: "debroussaillage", label: "Débroussaillage" },
  { id: "contrat_annuel", label: "Contrat d'entretien à l'année" },
  { id: "autre", label: "Autre projet" },
];

export default function BookingWizard({ companyPhone }: { companyPhone: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [projectType, setProjectType] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [addr, setAddr] = useState<AddressValue>({ address: "", postalCode: "", city: "" });
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [outOfZone, setOutOfZone] = useState(false);
  const [leadMessage, setLeadMessage] = useState("");
  const [leadSent, setLeadSent] = useState(false);

  const step2Valid =
    firstName.trim() &&
    lastName.trim() &&
    /^[\d+][\d\s.\-]{8,}$/.test(phone.trim()) &&
    /.+@.+\..+/.test(email.trim()) &&
    addr.address.trim() &&
    /^\d{5}$/.test(addr.postalCode);

  async function goToSlots() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/zone/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postalCode: addr.postalCode,
          address: `${addr.address}, ${addr.postalCode} ${addr.city}, France`,
        }),
      });
      const data = await res.json();
      if (data.covered) {
        trackMetaEvent("Lead");
        setStep(3);
      } else {
        setOutOfZone(true);
      }
    } catch {
      setError("Erreur réseau, réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function submitBooking() {
    if (!slot) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/bookings", {
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
          projectType,
          description,
          photos,
          startAt: slot,
        }),
      });
      const data = await res.json();
      if (res.status === 201) {
        trackMetaEvent("Schedule");
        router.push(`/confirmation/${data.id}`);
        return;
      }
      if (data.error === "creneau_indisponible") {
        setError("Ce créneau vient d'être réservé. Choisissez-en un autre.");
        setSlot(null);
      } else if (data.error === "hors_zone") {
        setOutOfZone(true);
      } else {
        setError("Une erreur est survenue. Vérifiez vos informations.");
      }
    } catch {
      setError("Erreur réseau, réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function submitLead() {
    setBusy(true);
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${firstName} ${lastName}`.trim(),
          phone,
          email,
          postalCode: addr.postalCode,
          message: leadMessage,
        }),
      });
      trackMetaEvent("Lead", { out_of_zone: true });
      setLeadSent(true);
    } finally {
      setBusy(false);
    }
  }

  // ---- Écran "hors zone" ----
  if (outOfZone) {
    return (
      <div className="card space-y-4" id="reserver">
        <h3 className="text-lg font-bold">Nous ne couvrons pas encore votre secteur 😕</h3>
        {leadSent ? (
          <p className="text-leaf-800">
            Merci ! Nous avons bien noté votre demande et nous vous recontacterons si nous
            intervenons prochainement dans votre secteur.
          </p>
        ) : (
          <>
            <p className="text-sm text-leaf-800/80">
              Laissez-nous vos coordonnées : nous vous préviendrons dès que nous
              interviendrons près de chez vous.
            </p>
            <textarea
              className="input min-h-[80px]"
              placeholder="Votre message (facultatif)"
              value={leadMessage}
              onChange={(e) => setLeadMessage(e.target.value)}
            />
            <button className="btn-primary" onClick={submitLead} disabled={busy}>
              {busy ? "Envoi…" : "Être recontacté(e)"}
            </button>
          </>
        )}
        <button className="btn-secondary" onClick={() => setOutOfZone(false)}>
          ← Modifier mon adresse
        </button>
      </div>
    );
  }

  return (
    <div className="card" id="reserver">
      {/* Indicateur d'étapes */}
      <div className="mb-5 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-leaf-600" : "bg-leaf-100"}`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Votre projet</h3>
          <div className="grid grid-cols-2 gap-2">
            {PROJECT_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setProjectType(t.id)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-3.5 text-left text-sm font-medium transition ${
                  projectType === t.id
                    ? "border-leaf-600 bg-leaf-50 text-leaf-800 ring-2 ring-leaf-500/25"
                    : "border-leaf-200 bg-white text-leaf-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <textarea
            className="input min-h-[90px]"
            placeholder="Décrivez votre projet en quelques mots (surface, attentes…)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <PhotoUpload photos={photos} onChange={setPhotos} />
          <button className="btn-primary" disabled={!projectType} onClick={() => setStep(2)}>
            Continuer →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Vos coordonnées</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="firstName">Prénom *</label>
              <input
                id="firstName"
                className="input"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="lastName">Nom *</label>
              <input
                id="lastName"
                className="input"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="phone">Téléphone mobile *</label>
            <input
              id="phone"
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="06 12 34 56 78"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="mt-1 text-xs text-leaf-800/60">
              Vous recevrez la confirmation et les rappels par SMS.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="email">Email *</label>
            <input
              id="email"
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="vous@exemple.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <AddressAutocomplete value={addr} onChange={setAddr} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button className="btn-secondary" onClick={() => setStep(1)}>← Retour</button>
            <button className="btn-primary" disabled={!step2Valid || busy} onClick={goToSlots}>
              {busy ? "Vérification…" : "Voir les créneaux →"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Choisissez votre créneau</h3>
          <p className="text-sm text-leaf-800/70">
            Seuls les créneaux réellement disponibles sont affichés.
          </p>
          <SlotPicker selected={slot} onSelect={setSlot} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button className="btn-secondary" onClick={() => setStep(2)}>← Retour</button>
            <button className="btn-primary" disabled={!slot || busy} onClick={submitBooking}>
              {busy ? "Réservation…" : "Confirmer mon RDV ✓"}
            </button>
          </div>
          <p className="text-center text-xs text-leaf-800/50">
            Gratuit et sans engagement — une question ? {companyPhone}
          </p>
        </div>
      )}
    </div>
  );
}
