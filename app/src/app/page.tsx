import fs from "fs";
import path from "path";
import BookingWizard from "@/components/BookingWizard";
import SiteHeader from "@/components/SiteHeader";
import StickyCta from "@/components/StickyCta";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Photos de réalisations : déposez vos images dans app/public/realisations/ (3 max affichées). */
function getGalleryPhotos(): string[] {
  try {
    const dir = path.join(process.cwd(), "public", "realisations");
    return fs
      .readdirSync(dir)
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort()
      .slice(0, 6)
      .map((f) => `/realisations/${f}`);
  } catch {
    return [];
  }
}

const STEPS = [
  {
    title: "Décrivez votre projet",
    text: "Expliquez-nous vos besoins en quelques mots et ajoutez des photos.",
  },
  { title: "Choisissez un créneau", text: "Uniquement nos vraies disponibilités, en temps réel." },
  { title: "C'est confirmé", text: "SMS immédiat + rappels avant le rendez-vous." },
];

export default async function LandingPage() {
  const settings = await getSettings();
  // Priorité aux photos gérées depuis l'admin, sinon fichiers de public/realisations/.
  const dbPhotos = await prisma.galleryPhoto.findMany({ orderBy: { sort: "asc" }, take: 6 });
  const galleryPhotos = dbPhotos.length > 0 ? dbPhotos.map((p) => p.dataUrl) : getGalleryPhotos();
  return (
    <main className="mx-auto max-w-lg px-4 pb-16 sm:max-w-2xl">
      <SiteHeader />

      {/* Hero */}
      <section className="py-6 text-center">
        <h1 className="text-3xl font-extrabold leading-tight text-leaf-950 sm:text-4xl">
          Le devis pour votre jardin, <span className="text-leaf-600">réservé en 60 secondes</span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-leaf-800/80">
          Choisissez un créneau, on se déplace gratuitement pour évaluer votre projet.
          Confirmation immédiate par SMS.
        </p>
        <a id="hero-cta" href="#reserver" className="btn-primary mt-5">
          Réserver mon RDV devis gratuit
        </a>
        <p className="mt-4 text-sm font-medium text-leaf-800/70">
          Plus de 100 clients satisfaits
        </p>
      </section>

      {/* Réalisations */}
      {galleryPhotos.length > 0 ? (
        <section className="grid grid-cols-3 gap-2 py-4">
          {galleryPhotos.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt="Réalisation Arboris Paysage"
              loading="lazy"
              decoding="async"
              className="aspect-square w-full rounded-2xl object-cover"
            />
          ))}
        </section>
      ) : (
        <>
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
            Ajoutez vos photos de réalisations depuis l&apos;espace admin (Paramètres)
            pour remplacer ces vignettes.
          </p>
        </>
      )}

      {/* Comment ça marche */}
      <section className="space-y-3 py-4">
        {STEPS.map((s, i) => (
          <div key={i} className="card flex items-start gap-4 py-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-leaf-600 text-sm font-bold text-white">
              {i + 1}
            </span>
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

      <p className="pt-6 text-center text-sm text-leaf-800/80">
        Une question ?{" "}
        <a
          href={`tel:${settings.companyPhone.replace(/\s/g, "")}`}
          className="font-semibold text-leaf-700"
        >
          {settings.companyPhone}
        </a>
      </p>

      <StickyCta />

      <footer className="pt-6 text-center text-xs text-leaf-800/50">
        © {new Date().getFullYear()} {settings.companyName} — {settings.companyPhone}
        <br />
        <a href="/admin" className="underline">Espace gérant</a>
      </footer>
    </main>
  );
}
