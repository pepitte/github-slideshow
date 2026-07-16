import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import ConsentReset from "@/components/ConsentReset";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mentions légales & confidentialité — Arboris Paysage",
};

const LEGAL = {
  name: "Arboris Paysage",
  siret: "914 126 230 00012",
  address: "4 place Barbacane, 34360 Saint-Chinian",
};

export default async function LegalPage() {
  const settings = await getSettings();
  return (
    <main className="mx-auto max-w-lg px-4 pb-16 sm:max-w-2xl">
      <SiteHeader />
      <h1 className="mt-2 text-2xl font-extrabold">Mentions légales & confidentialité</h1>

      <section className="card mt-6 space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-bold">Éditeur du site</h2>
        <p>
          {LEGAL.name} — SIRET {LEGAL.siret}
          <br />
          {LEGAL.address}
          <br />
          Téléphone : {settings.companyPhone} — Email : {settings.companyEmail}
        </p>
        <p>Directeur de la publication : le gérant de {LEGAL.name}.</p>
        <h2 className="pt-2 text-base font-bold">Hébergement</h2>
        <p>Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis — vercel.com</p>
      </section>

      <section className="card mt-4 space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-bold">Protection des données personnelles (RGPD)</h2>
        <p>
          Les informations saisies dans le formulaire de prise de rendez-vous (identité,
          téléphone, email, adresse du chantier, description du projet et photos
          éventuelles) sont utilisées uniquement pour organiser votre rendez-vous de
          devis : confirmation et rappels par SMS et email, préparation de la visite et
          suivi de votre demande.
        </p>
        <p>
          Base légale : exécution de mesures précontractuelles prises à votre demande
          (article 6.1.b du RGPD). Vos données sont conservées au maximum 3 ans après
          notre dernier échange, puis supprimées.
        </p>
        <p>
          Elles ne sont jamais revendues. Elles transitent par nos prestataires
          techniques strictement nécessaires au service : envoi de SMS (Twilio), envoi
          d&apos;emails (Resend), agenda et cartographie (Google), hébergement (Vercel).
          Certains prestataires sont situés aux États-Unis et encadrés par des clauses
          contractuelles types.
        </p>
        <p>
          Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement,
          d&apos;opposition, de limitation et de portabilité de vos données. Pour
          l&apos;exercer : {settings.companyPhone} ou {settings.companyEmail}. Vous pouvez
          également adresser une réclamation à la CNIL (cnil.fr).
        </p>
      </section>

      <section className="card mt-4 space-y-2 text-sm leading-relaxed">
        <h2 className="text-base font-bold">Cookies et mesure publicitaire</h2>
        <p>
          Le site utilise un cookie de session strictement nécessaire au fonctionnement
          de l&apos;espace gérant (exempté de consentement).
        </p>
        <p>
          Avec votre consentement uniquement (bannière affichée lors de votre première
          visite), un pixel de mesure Meta (Facebook/Instagram) est activé pour mesurer
          l&apos;efficacité de nos publicités. Si vous refusez, aucune donnée n&apos;est
          transmise à Meta et le site fonctionne normalement.
        </p>
        <ConsentReset />
      </section>

      <p className="mt-6 text-center">
        <Link href="/" className="text-sm font-semibold text-leaf-700 underline">
          ← Retour à l&apos;accueil
        </Link>
      </p>
    </main>
  );
}
