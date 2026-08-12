import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

export const metadata = { title: "Connexion — Arboris Paysage" };

// Point d'entrée unifié : le visiteur choisit son type de compte.
export default function ConnexionPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <SiteHeader />
      <h1 className="mb-1 mt-2 text-center text-2xl font-extrabold">Se connecter</h1>
      <p className="mb-6 text-center text-sm text-leaf-800/70">
        Créez votre compte ou connectez-vous.
      </p>

      <div className="space-y-3">
        <Link href="/compte/login" className="card block transition hover:border-leaf-300">
          <p className="font-bold text-leaf-900">Je suis un client</p>
          <p className="mt-1 text-sm text-leaf-800/70">
            Suivez et gérez vos rendez-vous de devis et d&apos;entretien.
          </p>
        </Link>
        <Link href="/pro/login" className="card block transition hover:border-leaf-300">
          <p className="font-bold text-leaf-900">Je suis un professionnel</p>
          <p className="mt-1 text-sm text-leaf-800/70">
            Déclarez vos disponibilités pour les devis et les chantiers.
          </p>
        </Link>
      </div>

      <Link href="/" className="mt-6 text-center text-sm text-leaf-700 underline">
        ← Retour à l&apos;accueil
      </Link>
      <Link
        href="/admin/login"
        className="mt-8 text-center text-xs text-leaf-800/40 hover:text-leaf-800/70"
      >
        Accès gérant
      </Link>
    </main>
  );
}
