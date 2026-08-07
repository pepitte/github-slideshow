"use client";

// Espace gérant : barre latérale à gauche sur toutes les pages (sauf connexion).
import { usePathname } from "next/navigation";
import AdminNav from "./AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") return <>{children}</>;
  return (
    <div className="flex min-h-screen">
      <AdminNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
