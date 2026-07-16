"use client";

import { useState } from "react";
import Link from "next/link";

export default function CancelActions({
  token,
  alreadyCancelled,
}: {
  token: string;
  alreadyCancelled: boolean;
}) {
  const [cancelled, setCancelled] = useState(alreadyCancelled);
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

  return (
    <div className="mt-6 space-y-3">
      <p className="text-sm text-leaf-800/70">
        Pour reporter : annulez ce rendez-vous puis choisissez un nouveau créneau.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={cancel} disabled={busy} className="btn-primary !bg-red-600 !shadow-red-600/25">
        {busy ? "Annulation…" : "Annuler mon rendez-vous"}
      </button>
      <Link href="/" className="btn-secondary w-full">← Conserver mon rendez-vous</Link>
    </div>
  );
}
