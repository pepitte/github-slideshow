import type { Metadata, Viewport } from "next";
import "./globals.css";
import MetaPixel from "@/components/MetaPixel";
import PwaInstall from "@/components/PwaInstall";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  // Repli statique si la BDD est indisponible (ex. prérendu au build).
  let companyName = "Arboris Paysage";
  try {
    companyName = (await getSettings()).companyName;
  } catch {}
  return {
    title: `${companyName} — RDV devis en ligne`,
    description:
      "Réservez votre rendez-vous de devis paysagiste en moins de 60 secondes. Créneaux en temps réel, confirmation immédiate par SMS.",
    // Le site s'installe sur l'écran d'accueil du téléphone comme une application.
    manifest: "/manifest.webmanifest",
    applicationName: companyName,
    appleWebApp: { capable: true, statusBarStyle: "default", title: companyName },
    icons: {
      icon: [
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: "/apple-touch-icon.png",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#347030",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Le pixel est réglable depuis l'admin ; la BDD peut manquer au prérendu.
  let pixelId = "";
  try {
    pixelId = (await getSettings()).metaPixelId;
  } catch {}
  return (
    <html lang="fr">
      <body>
        <MetaPixel pixelId={pixelId} />
        {children}
        <PwaInstall />
      </body>
    </html>
  );
}
