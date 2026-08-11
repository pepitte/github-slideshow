import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { parisTimeToUtc, addDaysStr, todayParis } from "@/lib/dates";
import { parseDates, parseDispo } from "@/lib/proStatus";
import { joursAbsents } from "@/lib/absences";
import { agencesActives } from "@/lib/agences";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/equipe?agence=…&du=…&au=… — l'agenda d'équipe d'un secteur :
 * une colonne par paysagiste, avec ses rendez-vous, ses disponibilités
 * déclarées et ses absences. C'est la vue à ouvrir quand un client est au
 * téléphone.
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const p = req.nextUrl.searchParams;
  const agenceId = (p.get("agence") ?? "").trim();
  const du = /^\d{4}-\d{2}-\d{2}$/.test(p.get("du") ?? "") ? p.get("du")! : todayParis();
  const au = /^\d{4}-\d{2}-\d{2}$/.test(p.get("au") ?? "") ? p.get("au")! : du;

  const agences = await agencesActives();
  const pros = await prisma.pro.findMany({
    where: agenceId ? { agenceId } : {},
    orderBy: { name: "asc" },
  });
  const proIds = pros.map((x) => x.id);

  const bookings = proIds.length
    ? await prisma.booking.findMany({
        where: {
          proId: { in: proIds },
          status: { not: "annule" },
          startAt: { gte: parisTimeToUtc(du, "00:00"), lt: parisTimeToUtc(addDaysStr(au, 1), "00:00") },
        },
        orderBy: { startAt: "asc" },
        select: {
          id: true,
          proId: true,
          kind: true,
          firstName: true,
          lastName: true,
          phone: true,
          city: true,
          address: true,
          startAt: true,
          endAt: true,
        },
      })
    : [];

  const absences = await joursAbsents(du, au);

  return NextResponse.json({
    du,
    au,
    agences: agences.map((a) => ({ id: a.id, nom: a.nom, couleur: a.couleur })),
    pros: pros.map((pro) => ({
      id: pro.id,
      name: pro.name,
      phone: pro.phone,
      baseCity: pro.baseCity,
      basePostalCode: pro.basePostalCode,
      radiusKm: pro.radiusKm,
      agenceId: pro.agenceId,
      // Ce qu'il a déclaré : jours de chantier, créneaux de visite, absences.
      jours: parseDates(pro.datesJson),
      dispo: parseDispo(pro.devisDispoJson),
      absents: Array.from(absences.get(pro.id) ?? []),
    })),
    bookings,
  });
}
