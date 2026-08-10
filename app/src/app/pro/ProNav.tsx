"use client";

// Barre latérale de l'espace professionnel : même esprit que celle du gérant
// (rail d'icônes seul sur mobile, libellés sur grand écran).
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const ICONS: Record<string, JSX.Element> = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  chantiers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  pointage: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  ),
  dispos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  ),
};

const LINKS = [
  { href: "/pro", label: "Tableau de bord", icon: "dashboard" },
  { href: "/pro/chantiers", label: "Mes chantiers", icon: "chantiers" },
  { href: "/pro/pointage", label: "Pointage", icon: "pointage" },
  { href: "/pro/disponibilites", label: "Disponibilités", icon: "dispos" },
];

export default function ProNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/pro/logout", { method: "POST" });
    router.push("/pro/login");
  }

  return (
    <aside className="sticky top-0 flex h-screen w-14 shrink-0 flex-col border-r border-leaf-100 bg-white print:hidden sm:w-56">
      <div className="flex items-center justify-center px-2 py-4 sm:justify-start sm:px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Arboris Paysage" className="h-9 w-auto max-w-full object-contain" />
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
        {LINKS.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== "/pro" && pathname.startsWith(href + "/"));
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`flex items-center justify-center gap-3 rounded-xl px-2 py-2.5 text-sm font-medium transition sm:justify-start sm:px-3 ${
                active ? "bg-leaf-600 text-white" : "text-leaf-800 hover:bg-leaf-50"
              }`}
            >
              {ICONS[icon]}
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-leaf-100 px-2 py-3 sm:px-3">
        <p className="hidden truncate px-1 pb-2 text-xs text-leaf-800/50 sm:block">Espace professionnel</p>
        <button
          onClick={logout}
          title="Déconnexion"
          className="flex w-full items-center justify-center gap-3 rounded-xl px-2 py-2.5 text-sm font-medium text-leaf-800/70 transition hover:bg-leaf-50 hover:text-leaf-900 sm:justify-start sm:px-3"
        >
          {ICONS.logout}
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
