"use client";

// Installation sur l'écran d'accueil : enregistre le service worker (critère
// d'installabilité) et propose un bandeau discret quand le navigateur le permet.
// Sur iPhone, Safari n'expose pas d'invite : on rappelle le geste « Partager →
// Sur l'écran d'accueil ».
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa-invite-masquee";

export default function PwaInstall() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [iosHint, setIosHint] = useState(false);
  // Espace gérant : pas d'invitation à installer (usage surtout sur ordinateur).
  const masque = (usePathname() ?? "").startsWith("/admin");

  useEffect(() => {
    if (masque) return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    // Déjà installée : rien à proposer.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const ua = window.navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua)) {
      setIosHint(true);
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [masque]);

  function close() {
    localStorage.setItem(DISMISS_KEY, "1");
    setPrompt(null);
    setIosHint(false);
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    close();
  }

  if (masque || (!prompt && !iosHint)) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-2xl border border-leaf-200 bg-white p-3 shadow-lg">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-leaf-900">Ajouter à l&apos;écran d&apos;accueil</p>
          <p className="text-xs text-leaf-800/70">
            {prompt
              ? "Retrouvez vos rendez-vous en un geste, comme une application."
              : "Appuyez sur Partager, puis « Sur l'écran d'accueil »."}
          </p>
        </div>
        {prompt && (
          <button
            onClick={install}
            className="whitespace-nowrap rounded-xl bg-leaf-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Installer
          </button>
        )}
        <button onClick={close} aria-label="Fermer" className="px-1 text-leaf-800/50">
          ✕
        </button>
      </div>
    </div>
  );
}
