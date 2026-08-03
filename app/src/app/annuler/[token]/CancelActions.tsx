"use client";

// Gestion du RDV par le client (depuis le lien SMS/email) :
// reporter sur un nouveau créneau, ou annuler (libère le créneau).
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SlotPicker from "@/components/SlotPicker";

export default function CancelActions({
  token,
  alreadyCancelled,
}: {
  token: string;
  alreadyCancelled: boolean;
}) {
  const router = useRouter();
  const [cancelled, setCancelled] = useState(alreadyCancelled);
  const [rescheduling, setRescheduling] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const [chantierDuration, setChantierDuration] = useState<"demi" | "journee" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) setCancelled(true);
      else setError("Impossible d'annuler ce rendez-vous. Appelez-nous directement.");
    } catch {
      setError("Erreur réseau, réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function reschedule() {
    if (!slot) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/bookings/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, startAt: slot, chantierDuration }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/confirmation/${data.id}`);
        return;
      }
      if (data.error === "creneau_indisponible") {
        setError("Ce créneau vient d'être pris. Choisissez-en un autre.");
        setSlot(null);
        setChantierDuration(null);
      } else {
        setError("Impossible de déplacer ce rendez-vous. Appelez-nous directement.");
      }
    } catch {
      setError("Erreur réseau, réessayez.");
    } finally {
      setBusy(false);
    }
  }

  if (cancelled) {
    return (
      <div className="mt-6 space-y-4">
        <p className="rounded-xl bg-leaf-50 p-4 text-leaf-800">
          ✓ Votre rendez-vous est annulé et le créneau a été libéré.
        </p>
        <Link href="/#reserver" className="btn-primary">
          Reprendre un nouveau rendez-vous
        </Link>
      </div>
    );
  }

  if (rescheduling) {
    return (
      <div className="mt-6 space-y-4">
        <h2 className="text-lg font-bold">Choisissez votre nouveau créneau</h2>
        <SlotPicker
          selected={slot}
          selectedDuration={chantierDuration}
          onSelect={(iso, duration) => {
            setSlot(iso);
            setChantierDuration(duration ?? null);
          }}
          token={token}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-col gap-2">
          <button className="btn-primary" disabled={!slot || busy} onClick={reschedule}>
            {busy ? "Modification…" : "Confirmer le nouveau créneau"}
          </button>
          <button className="btn-secondary" onClick={() => setRescheduling(false)}>
            ← Retour
          </button>
        </div>
        <p className="text-center text-xs text-leaf-800/50">
          Vous recevrez un nouveau SMS de confirmation avec la nouvelle date.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <button className="btn-primary w-full" onClick={() => setRescheduling(true)}>
        Modifier le rendez-vous (nouveau créneau)
      </button>
      <button onClick={cancel} disabled={busy} className="btn-primary w-full !bg-red-600 !shadow-red-600/25">
        {busy ? "Annulation…" : "Annuler le rendez-vous"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Link href="/" className="btn-secondary w-full">← Conserver mon rendez-vous</Link>
    </div>
  );
}
