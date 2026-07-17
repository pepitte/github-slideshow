import type { Metadata, Viewport } from "next";
import "./globals.css";
import MetaPixel from "@/components/MetaPixel";
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
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#347030",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <MetaPixel />
        {children}
      </body>
    </html>
  );
}
