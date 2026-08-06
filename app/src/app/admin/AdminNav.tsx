"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  const linkClass = (href: string) =>
    `rounded-xl px-4 py-2 text-sm font-medium ${
      pathname === href ? "bg-leaf-600 text-white" : "text-leaf-800 hover:bg-leaf-100"
    }`;

  return (
    <nav className="mb-6 flex items-center gap-2 border-b border-leaf-100 pb-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Arboris Paysage" className="mr-2 h-8 w-auto object-contain" />
      <Link href="/admin" className={linkClass("/admin")}>Tableau de bord</Link>
      <Link href="/admin/planning" className={linkClass("/admin/planning")}>Planning</Link>
      <Link href="/admin/pros" className={linkClass("/admin/pros")}>Professionnels</Link>
      <Link href="/admin/parametres" className={linkClass("/admin/parametres")}>Paramètres</Link>
      <button onClick={logout} className="ml-auto text-sm text-leaf-800/60 hover:text-leaf-800">
        Déconnexion
      </button>
    </nav>
  );
}
