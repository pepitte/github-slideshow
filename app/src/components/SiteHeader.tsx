import fs from "fs";
import path from "path";
import { getSettings } from "@/lib/settings";

/** Logo : réglé depuis l'admin, sinon fichier app/public/logo.png|jpg|webp s'il existe. */
function getLogoFile(): string {
  for (const name of ["logo.png", "logo.jpg", "logo.jpeg", "logo.webp"]) {
    try {
      if (fs.existsSync(path.join(process.cwd(), "public", name))) return `/${name}`;
    } catch {}
  }
  return "";
}

/** En-tête commun des pages publiques : logo centré. */
export default async function SiteHeader() {
  const settings = await getSettings();
  const logoUrl = settings.logoUrl || getLogoFile();
  return (
    <header className="flex items-center justify-center py-4">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={settings.companyName}
          className="h-14 w-auto max-w-[230px] object-contain"
        />
      ) : (
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf-600 text-lg">
            🌿
          </span>
          <span className="font-bold text-leaf-900">{settings.companyName}</span>
        </div>
      )}
    </header>
  );
}
