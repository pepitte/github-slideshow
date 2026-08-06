"use client";

// Connexion / création de compte particulier.
import { useState } from "react";
import { useRouter } from "next/navigation";
import AddressAutocomplete, { type AddressValue } from "@/components/AddressAutocomplete";

export default function ClientLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addr, setAddr] = useState<AddressValue>({ address: "", postalCode: "", city: "" });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const url = mode === "register" ? "/api/client/register" : "/api/client/login";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          password,
          address: addr.address,
          postalCode: addr.postalCode,
          city: addr.city,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push("/compte");
        router.refresh();
      } else if (data.error === "email_existe") {
        setError("Un compte existe déjà avec cet email. Connectez-vous.");
        setMode("login");
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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Arboris Paysage" className="mx-auto h-14 w-auto object-contain" />
      <h1 className="mb-1 mt-2 text-center text-2xl font-extrabold">Mon compte</h1>
      <p className="mb-5 text-center text-sm text-leaf-800/70">
        Retrouvez et gérez vos rendez-vous.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-leaf-50 p-1">
        <button
          onClick={() => setMode("login")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            mode === "login" ? "bg-white text-leaf-800 shadow-sm" : "text-leaf-800/60"
          }`}
        >
          Connexion
        </button>
        <button
          onClick={() => setMode("register")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            mode === "register" ? "bg-white text-leaf-800 shadow-sm" : "text-leaf-800/60"
          }`}
        >
          Créer un compte
        </button>
      </div>

      <form onSubmit={submit} className="card space-y-4">
        {mode === "register" && (
          <>
            <div>
              <label className="label" htmlFor="name">Prénom / nom</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="phone">Téléphone</label>
              <input id="phone" className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <AddressAutocomplete value={addr} onChange={setAddr} label="Adresse de votre jardin *" />
            <p className="-mt-1 text-xs text-leaf-800/60">
              Enregistrée une fois pour toutes : vos prochaines réservations seront
              pré-remplies.
            </p>
          </>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {mode === "register" && (
            <p className="mt-1 text-xs text-leaf-800/60">
              Utilisez l&apos;email de vos réservations pour les retrouver automatiquement.
            </p>
          )}
        </div>
        <div>
          <label className="label" htmlFor="password">Mot de passe</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "…" : mode === "register" ? "Créer mon compte" : "Se connecter"}
        </button>
      </form>

      <a href="/" className="mt-6 text-center text-sm text-leaf-700 underline">← Retour à l&apos;accueil</a>
    </main>
  );
}
