import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getAvailability } from "@/lib/availability";
import { prosDevis } from "@/lib/assign";
import { cpToLatLng, distanceKm } from "@/lib/geo";
import { utcToParis } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/admin/equipe/creneaux?cp=33000&n=5 — les prochains créneaux de
 * visite réellement disponibles pour un client donné, avec le paysagiste qui
 * les couvre. C'est la réponse au « je suis au téléphone, quand puis-je
 * proposer ? » : le gérant n'ouvre plus chaque agenda un par un.
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const cp = (req.nextUrl.searchParams.get("cp") ?? "").trim();
  if (!/^\d{5}$/.test(cp)) {
    return NextResponse.json({ error: "Indiquez le code postal du client." }, { status: 400 });
  }
  const combien = Math.min(20, Math.max(1, Number(req.nextUrl.searchParams.get("n")) || 6));

  const settings = await getSettings();
  // Mêmes créneaux que ceux proposés au client sur le site : une seule source
  // de vérité, donc aucun risque de proposer un horaire qui serait refusé.
  const jours = await getAvailability(settings, undefined, cp);
  const pros = await prosDevis();
  const posClient = cpToLatLng(cp);

  const creneaux: {
    startAt: string;
    date: string;
    heure: string;
    pro: { id: string; name: string; phone: string; distance: number | null } | null;
  }[] = [];

  for (const jour of jours) {
    for (const iso of jour.slots) {
      if (creneaux.length >= combien) break;
      const paris = utcToParis(new Date(iso));
      // Quel paysagiste a déclaré ce créneau, et lequel est le plus proche ?
      const candidats = pros
        .filter((p) => (p.dispo[paris.date] ?? []).includes(paris.time))
        .map((p) => {
          const pos = cpToLatLng(p.basePostalCode);
          const d = posClient && pos ? Math.round(distanceKm(posClient, pos) * 10) / 10 : null;
          return { pro: p, distance: d };
        })
        .filter((c) => c.distance === null || c.distance <= c.pro.radiusKm)
        .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
      const gagnant = candidats[0];
      creneaux.push({
        startAt: iso,
        date: paris.date,
        heure: paris.time,
        pro: gagnant
          ? {
              id: gagnant.pro.id,
              name: gagnant.pro.name,
              phone: gagnant.pro.phone,
              distance: gagnant.distance,
            }
          : null, // créneau des horaires du gérant : la visite lui revient
      });
    }
    if (creneaux.length >= combien) break;
  }

  return NextResponse.json({ cp, creneaux });
}
