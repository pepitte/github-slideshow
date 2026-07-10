import BookingWizard from "@/components/BookingWizard";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const REVIEWS = [
  { name: "Marie L.", text: "Devis rapide, jardin transformé en une semaine. Je recommande !" },
  { name: "Karim B.", text: "Très pro, ponctuel, et la terrasse est magnifique." },
  { name: "Sophie D.", text: "Prise de RDV en 1 minute sur mon téléphone, top." },
];

const STEPS = [
  { emoji: "📝", title: "Décrivez votre projet", text: "2 ou 3 questions, ajoutez des photos si vous voulez." },
  { emoji: "📅", title: "Choisissez un créneau", text: "Uniquement nos vraies disponibilités, en temps réel." },
  { emoji: "✅", title: "C'est confirmé", text: "SMS immédiat + rappels avant le rendez-vous." },
];

export default async function LandingPage() {
  const settings = await getSettings();
  return (
    <main className="mx-auto max-w-lg px-4 pb-16 sm:max-w-2xl">
      {/* En-tête */}
      <header className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          {settings.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoUrl} alt={settings.companyName} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf-600 text-lg">🌿</span>
          )}
          <span className="font-bold text-leaf-900">{settings.companyName}</span>
        </div>
        <a href={`tel:${settings.companyPhone.replace(/\s/g, "")}`} className="text-sm font-semibold text-leaf-700">
          {settings.companyPhone}
        </a>
      </header>

      {/* Hero */}
      <section className="py-6 text-center">
        <h1 className="text-3xl font-extrabold leading-tight text-leaf-950 sm:text-4xl">
          Votre devis paysagiste, <span className="text-leaf-600">réservé en 60 secondes</span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-leaf-800/80">
          Choisissez un créneau, on se déplace gratuitement pour évaluer votre projet.
          Confirmation immédiate par SMS.
        </p>
        <a href="#reserver" className="btn-primary mt-5">
          📅 Réserver mon RDV devis gratuit
        </a>
        <div className="mt-4 flex items-center justify-center gap-1 text-sm text-leaf-800/70">
          <span aria-hidden>⭐⭐⭐⭐⭐</span>
          <span>4,9/5 — plus de 120 clients satisfaits</span>
        </div>
      </section>

      {/* Réalisations */}
      <section className="grid grid-cols-3 gap-2 py-4">
        {["🌳", "🪴", "🏡"].map((emoji, i) => (
          <div
            key={i}
            className="flex aspect-square items-center justify-center rounded-2xl bg-gradient-to-br from-leaf-100 to-leaf-200 text-5xl"
            aria-hidden
          >
            {emoji}
          </div>
        ))}
      </section>
      <p className="pb-4 text-center text-xs text-leaf-800/50">
        Remplacez ces vignettes par vos photos de réalisations depuis l&apos;espace admin.
      </p>

      {/* Comment ça marche */}
      <section className="space-y-3 py-4">
        {STEPS.map((s, i) => (
          <div key={i} className="card flex items-start gap-4 py-4">
            <span className="text-2xl" aria-hidden>{s.emoji}</span>
            <div>
              <h2 className="font-semibold">{s.title}</h2>
              <p className="text-sm text-leaf-800/70">{s.text}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Tunnel de réservation */}
      <section className="py-6">
        <h2 className="mb-4 text-center text-xl font-bold">Réservez votre visite devis</h2>
        <BookingWizard companyPhone={settings.companyPhone} />
      </section>

      {/* Avis */}
      <section className="space-y-3 py-4">
        <h2 className="text-center text-xl font-bold">Ils nous font confiance</h2>
        {REVIEWS.map((r, i) => (
          <blockquote key={i} className="card py-4">
            <p className="text-sm text-leaf-900">“{r.text}”</p>
            <footer className="mt-2 text-xs font-semibold text-leaf-700">
              {r.name} <span aria-hidden>⭐⭐⭐⭐⭐</span>
            </footer>
          </blockquote>
        ))}
      </section>

      <footer className="pt-8 text-center text-xs text-leaf-800/50">
        © {new Date().getFullYear()} {settings.companyName} — {settings.companyPhone}
        <br />
        <a href="/admin" className="underline">Espace gérant</a>
      </footer>
    </main>
  );
}
