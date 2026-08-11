"use client";

// Connexion / inscription libre des professionnels.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AddressAutocomplete, { type AddressValue } from "@/components/AddressAutocomplete";

export default function ProLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addr, setAddr] = useState<AddressValue>({ address: "", postalCode: "", city: "" });
  const [radiusKm, setRadiusKm] = useState(30);
  // Secteurs proposés à l'inscription (Bordeaux, Béziers…), s'il en existe.
  const [agences, setAgences] = useState<{ id: string; nom: string; city: string }[]>([]);
  const [agenceId, setAgenceId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/agences")
      .then((r) => (r.ok ? r.json() : { agences: [] }))
      .then((d) => setAgences(d.agences ?? []))
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const url = mode === "register" ? "/api/pro/register" : "/api/pro/login";
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
          radiusKm,
          agenceId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push("/pro");
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
      <h1 className="mb-1 mt-2 text-center text-2xl font-extrabold">Espace professionnel</h1>
      <p className="mb-5 text-center text-sm text-leaf-800/70">
        Déclarez vos disponibilités pour les devis et les chantiers.
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
          Inscription
        </button>
      </div>

      <form onSubmit={submit} className="card space-y-4">
        {mode === "register" && (
          <>
            <div>
              <label className="label" htmlFor="name">Nom / entreprise</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="phone">Téléphone</label>
              <input id="phone" className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <AddressAutocomplete value={addr} onChange={setAddr} label="Adresse de départ *" />
            <p className="-mt-1 text-xs text-leaf-800/60">
              Elle indique votre secteur d&apos;intervention au gérant.
            </p>
            {agences.length > 0 && (
              <div>
                <label className="label" htmlFor="agence">Secteur *</label>
                <select
                  id="agence"
                  className="input"
                  value={agenceId}
                  onChange={(e) => setAgenceId(e.target.value)}
                  required
                >
                  <option value="">— Choisissez votre secteur —</option>
                  {agences.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nom}
                      {a.city ? ` (${a.city})` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-leaf-800/60">
                  L&apos;équipe à laquelle vous êtes rattaché, pour l&apos;agenda partagé.
                </p>
              </div>
            )}
            <div>
              <label className="label" htmlFor="radius">Rayon d&apos;intervention (km)</label>
              <input
                id="radius"
                className="input"
                type="number"
                min={0}
                max={200}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
              />
            </div>
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
          {mode === "register" && (
            <p className="mt-1 text-xs text-leaf-800/60">6 caractères minimum.</p>
          )}
          {mode === "login" && (
            <a href="/pro/reinitialiser" className="mt-1.5 inline-block text-xs text-leaf-700 underline">
              Mot de passe oublié ?
            </a>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "…" : mode === "register" ? "Créer mon compte" : "Se connecter"}
        </button>
      </form>
    </main>
  );
}
