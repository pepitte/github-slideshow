"use client";

// Bouton « Réserver » qui reste visible en bas de l'écran pendant le défilement.
// Masqué quand le bouton du hero ou le formulaire de réservation est déjà à l'écran.
import { useEffect, useState } from "react";

export default function StickyCta() {
  const [heroVisible, setHeroVisible] = useState(true);
  const [formVisible, setFormVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero-cta");
    const form = document.getElementById("reserver");
    if (!hero || !form) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === hero) setHeroVisible(entry.isIntersecting);
        if (entry.target === form) setFormVisible(entry.isIntersecting);
      }
    });
    observer.observe(hero);
    observer.observe(form);
    return () => observer.disconnect();
  }, []);

  if (heroVisible || formVisible) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:max-w-2xl">
      <a href="#reserver" className="btn-primary w-full shadow-2xl">
        Réserver mon RDV devis gratuit
      </a>
    </div>
  );
}
