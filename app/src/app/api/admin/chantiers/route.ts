import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { parisTimeToUtc, addDaysStr } from "@/lib/dates";

export const dynamic = "force-dynamic";

const MAX_RESULTATS = 60;

function photos(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((p) => typeof p === "string") : [];
  } catch {
    return [];
  }
}

/**
 * GET /api/admin/chantiers?etat=en_cours|termines&client= — les rapports
 * d'intervention avant / après, tels que les paysagistes les remplissent
 * depuis leur pointage. Une carte = une journée sur un chantier.
 *
 * Le rapport est rattaché au client via le rendez-vous de ce paysagiste ce
 * jour-là ; sans rendez-vous, la carte reste utile (photos + auteur).
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const p = req.nextUrl.searchParams;
  const etat = p.get("etat") ?? "en_cours";
  const contactId = (p.get("client") ?? "").trim();

  // Seules les journées comportant au moins une photo sont des « rapports ».
  const journees = await prisma.workEntry.findMany({
    where: {
      validated: etat === "termines",
      NOT: [{ photosBeforeJson: "[]" }, { photosAfterJson: "[]" }],
    },
    orderBy: { date: "desc" },
    take: MAX_RESULTATS * 2,
    include: { pro: { select: { id: true, name: true } } },
  });

  // Le chantier du jour pour ce paysagiste : donne le client et l'adresse.
  const rapports = [];
  for (const j of journees) {
    const booking = await prisma.booking.findFirst({
      where: {
        proId: j.proId,
        status: { not: "annule" },
        startAt: {
          gte: parisTimeToUtc(j.date, "00:00"),
          lt: parisTimeToUtc(addDaysStr(j.date, 1), "00:00"),
        },
      },
      select: {
        id: true,
        contactId: true,
        firstName: true,
        lastName: true,
        city: true,
        address: true,
        projectType: true,
      },
    });
    if (contactId && booking?.contactId !== contactId) continue;
    const avant = photos(j.photosBeforeJson);
    const apres = photos(j.photosAfterJson);
    if (!avant.length && !apres.length) continue;
    rapports.push({
      id: j.id,
      date: j.date,
      validated: j.validated,
      pro: j.pro,
      avant,
      apres,
      booking,
    });
    if (rapports.length >= MAX_RESULTATS) break;
  }

  // Les clients ayant au moins un chantier : alimente le filtre.
  const clients = await prisma.contact.findMany({
    where: { bookings: { some: { kind: "chantier" } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });

  // Compteurs des deux onglets, indépendants du filtre en cours.
  const [enCours, termines] = await Promise.all([
    prisma.workEntry.count({
      where: { validated: false, NOT: [{ photosBeforeJson: "[]" }, { photosAfterJson: "[]" }] },
    }),
    prisma.workEntry.count({
      where: { validated: true, NOT: [{ photosBeforeJson: "[]" }, { photosAfterJson: "[]" }] },
    }),
  ]);

  return NextResponse.json({
    rapports,
    clients,
    compteurs: { enCours, termines, total: enCours + termines },
  });
}
