"use client";

// Cloche de notifications du gérant : pastille rouge dans la barre latérale,
// panneau glissant à droite. Ce qui attend une action (chantier à attribuer,
// relance à faire) apparaît au même endroit que ce qui vient d'arriver.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Notification = {
  id: string;
  type: "rdv" | "lead" | "attribuer" | "rapport" | "relance" | "annule";
  titre: string;
  texte: string;
  date: string;
  lien: string;
  lue: boolean;
};

const ICONES: Record<Notification["type"], JSX.Element> = {
  rdv: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </>
  ),
  lead: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </>
  ),
  attribuer: (
    <>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </>
  ),
  rapport: (
    <>
      <path d="M9 3h6a1 1 0 0 1 1 1v2H8V4a1 1 0 0 1 1-1z" />
      <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
      <path d="m9 13 2 2 4-4" />
    </>
  ),
  relance: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  annule: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6M9 9l6 6" />
    </>
  ),
};

// Ce qui réclame une action porte une couleur d'alerte ; le reste est neutre.
const TONS: Record<Notification["type"], string> = {
  rdv: "bg-leaf-50 text-leaf-700",
  lead: "bg-blue-50 text-blue-700",
  attribuer: "bg-amber-50 text-amber-700",
  rapport: "bg-leaf-50 text-leaf-700",
  relance: "bg-amber-50 text-amber-700",
  annule: "bg-red-50 text-red-600",
};

function quand(iso: string): string {
  const d = new Date(iso);
  const minutes = Math.round((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 24 * 60) return `il y a ${Math.round(minutes / 60)} h`;
  return d.toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminNotifications() {
  const [ouvert, setOuvert] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [nonLues, setNonLues] = useState(0);
  const [charge, setCharge] = useState(false);

  const charger = useCallback(() => {
    fetch("/api/admin/notifications")
      .then((r) => (r.ok ? r.json() : { notifications: [], nonLues: 0 }))
      .then((d) => {
        setItems(d.notifications ?? []);
        setNonLues(d.nonLues ?? 0);
      })
      .catch(() => {})
      .finally(() => setCharge(true));
  }, []);

  useEffect(() => {
    charger();
    // Rafraîchissement discret : le gérant laisse souvent l'onglet ouvert.
    const t = setInterval(charger, 120000);
    return () => clearInterval(t);
  }, [charger]);

  // Échap ferme le panneau, comme partout ailleurs.
  useEffect(() => {
    if (!ouvert) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [ouvert]);

  async function toutLire() {
    await fetch("/api/admin/notifications", { method: "POST" });
    setItems((l) => l.map((n) => ({ ...n, lue: true })));
    setNonLues(0);
  }

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        title="Notifications"
        aria-label={nonLues > 0 ? `Notifications, ${nonLues} non lues` : "Notifications"}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-leaf-800/70 transition hover:bg-leaf-50 hover:text-leaf-900"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {nonLues > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
            {nonLues > 9 ? "9+" : nonLues}
          </span>
        )}
      </button>

      {ouvert && (
        <>
          <button
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setOuvert(false)}
            aria-label="Fermer les notifications"
          />
          <aside className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-sm flex-col border-l border-leaf-100 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-2 border-b border-leaf-100 px-4 py-4">
              <div>
                <h2 className="text-lg font-bold">Notifications</h2>
                <p className="text-sm text-leaf-800/60">
                  {nonLues > 0 ? `${nonLues} non lue${nonLues > 1 ? "s" : ""}` : "Tout est à jour"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {nonLues > 0 && (
                  <button onClick={toutLire} className="text-sm font-semibold text-leaf-700 underline">
                    Tout marquer comme lu
                  </button>
                )}
                <button
                  onClick={() => setOuvert(false)}
                  aria-label="Fermer"
                  className="text-2xl leading-none text-leaf-800/50 hover:text-leaf-900"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {!charge && <p className="p-6 text-center text-sm text-leaf-800/60">Chargement…</p>}
              {charge && items.length === 0 && (
                <p className="p-6 text-center text-sm text-leaf-800/60">
                  Rien de nouveau. Les réservations, prospects, rapports de chantier et
                  relances à faire apparaîtront ici.
                </p>
              )}
              {items.map((n) => (
                <Link
                  key={n.id}
                  href={n.lien}
                  onClick={() => setOuvert(false)}
                  className={`flex gap-3 border-b border-leaf-50 px-4 py-3 transition hover:bg-leaf-50/60 ${
                    n.lue ? "" : "bg-leaf-50/30"
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONS[n.type]}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                      {ICONES[n.type]}
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold text-leaf-900">{n.titre}</span>
                      {!n.lue && <span className="h-2 w-2 shrink-0 rounded-full bg-leaf-600" />}
                    </span>
                    <span className="block text-sm text-leaf-800/75">{n.texte}</span>
                    <span className="block text-xs text-leaf-800/50">{quand(n.date)}</span>
                  </span>
                </Link>
              ))}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
