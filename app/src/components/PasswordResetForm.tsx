"use client";

// Mot de passe oublié (partagé particuliers / pros) : demande du lien, puis
// choix du nouveau mot de passe quand la page est ouverte depuis l'email (?token=...).
import { useEffect, useState } from "react";

export default function PasswordResetForm({
  apiBase,
  loginHref,
  title = "Mot de passe oublié",
}: {
  apiBase: string;
  loginHref: string;
  title?: string;
}) {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await fetch(`${apiBase}/reset-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setError("Erreur réseau, réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/reset-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) setDone(true);
      else if (data.error === "lien_invalide")
        setError("Ce lien est invalide ou a expiré (il est valable 1 heure). Redemandez-en un.");
      else setError(data.error || "Une erreur est survenue.");
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
      <h1 className="mb-1 mt-2 text-center text-2xl font-extrabold">{title}</h1>

      {done ? (
        <div className="card mt-4 text-center">
          <p className="font-semibold text-leaf-800">✓ Mot de passe modifié</p>
          <p className="mt-1 text-sm text-leaf-800/70">Vous pouvez maintenant vous connecter.</p>
          <a href={loginHref} className="btn-primary mt-4">Se connecter</a>
        </div>
      ) : token ? (
        <form onSubmit={confirm} className="card mt-4 space-y-4">
          <p className="text-sm text-leaf-800/70">Choisissez votre nouveau mot de passe.</p>
          <div>
            <label className="label" htmlFor="password">Nouveau mot de passe</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-leaf-800/60">6 caractères minimum.</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "…" : "Enregistrer le mot de passe"}
          </button>
        </form>
      ) : sent ? (
        <div className="card mt-4 text-center">
          <p className="font-semibold text-leaf-800">Email envoyé</p>
          <p className="mt-1 text-sm text-leaf-800/70">
            Si un compte existe avec cette adresse, vous recevrez un lien de
            réinitialisation (valable 1 heure). Pensez à vérifier vos spams.
          </p>
        </div>
      ) : (
        <form onSubmit={requestLink} className="card mt-4 space-y-4">
          <p className="text-sm text-leaf-800/70">
            Indiquez l&apos;email de votre compte : nous vous enverrons un lien pour
            choisir un nouveau mot de passe.
          </p>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "…" : "Recevoir le lien"}
          </button>
        </form>
      )}

      <a href={loginHref} className="mt-6 text-center text-sm text-leaf-700 underline">
        ← Retour à la connexion
      </a>
    </main>
  );
}
