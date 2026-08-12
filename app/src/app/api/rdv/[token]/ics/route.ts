import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { buildIcsGroup } from "@/lib/ics";

export const dynamic = "force-dynamic";

/**
 * GET /api/rdv/:token/ics — « Ajouter à mon agenda ».
 *
 * Le jeton est celui du lien d'annulation, déjà connu du client (SMS, email,
 * espace personnel) : pas besoin d'être connecté, et rien d'autre n'est exposé
 * que le rendez-vous correspondant. Un chantier de plusieurs jours renvoie
 * autant d'événements dans un seul fichier.
 */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const booking = await prisma.booking.findUnique({ where: { cancelToken: params.token } });
  if (!booking || booking.status === "annule") {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }
  const principal = booking.groupId || booking.id;
  const jours = await prisma.booking.findMany({
    where: { OR: [{ id: principal }, { groupId: principal }] },
    orderBy: { startAt: "asc" },
  });
  const settings = await getSettings();
  const ics = buildIcsGroup(jours.length ? jours : [booking], settings);
  if (!ics) {
    return NextResponse.json({ error: "Ce rendez-vous n'a pas encore de date." }, { status: 400 });
  }
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rendez-vous.ics"',
    },
  });
}
