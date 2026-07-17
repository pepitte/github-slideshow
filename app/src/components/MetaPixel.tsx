"use client";

// Pixel Meta soumis au consentement (RGPD/CNIL) : le script n'est chargé
// qu'après acceptation via la bannière. Sans pixel configuré, rien ne s'affiche.
import { useEffect, useState } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

const CONSENT_KEY = "consent-meta";

/** Déclenche un événement de conversion Meta (no-op sans pixel ou sans consentement). */
export function trackMetaEvent(event: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", event, params);
  }
}

function loadPixel(pixelId: string) {
  if (window.fbq) return;
  const fbq: any = function (...args: unknown[]) {
    // eslint-disable-next-line prefer-spread
    fbq.callMethod ? fbq.callMethod.apply(fbq, args) : fbq.queue.push(args);
  };
  window.fbq = fbq;
  window._fbq = fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  fbq("init", pixelId);
  fbq("track", "PageView");
}

export default function MetaPixel() {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  // null = pas encore répondu (bannière affichée), "yes"/"no" = choix enregistré
  const [consent, setConsent] = useState<string | null | "pending">("pending");

  useEffect(() => {
    if (!pixelId) return;
    const stored = localStorage.getItem(CONSENT_KEY);
    setConsent(stored);
    if (stored === "yes") loadPixel(pixelId);
  }, [pixelId]);

  if (!pixelId || consent !== null) return null;

  function choose(value: "yes" | "no") {
    localStorage.setItem(CONSENT_KEY, value);
    setConsent(value);
    if (value === "yes") loadPixel(pixelId!);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3">
      <div className="mx-auto max-w-lg rounded-2xl border border-leaf-200 bg-white p-4 shadow-2xl sm:max-w-2xl">
        <p className="text-sm text-leaf-950">
          Nous utilisons un traceur Meta, avec votre accord, pour mesurer
          l&apos;efficacité de nos publicités. Votre choix n&apos;affecte pas le
          fonctionnement du site.{" "}
          <a href="/mentions-legales" className="font-semibold text-leaf-700 underline">
            En savoir plus
          </a>
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl bg-leaf-600 px-4 py-2.5 text-sm font-semibold text-white"
            onClick={() => choose("yes")}
          >
            Accepter
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl border border-leaf-200 bg-white px-4 py-2.5 text-sm font-medium text-leaf-800"
            onClick={() => choose("no")}
          >
            Continuer sans accepter
          </button>
        </div>
      </div>
    </div>
  );
}
