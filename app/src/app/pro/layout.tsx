"use client";

// Espace professionnel : barre latérale à gauche sur toutes les pages
// (sauf connexion et réinitialisation de mot de passe).
import { usePathname } from "next/navigation";
import ProNav from "./ProNav";

export default function ProLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/pro/login" || pathname === "/pro/reinitialiser") return <>{children}</>;
  return (
    <div className="flex min-h-screen">
      <ProNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
