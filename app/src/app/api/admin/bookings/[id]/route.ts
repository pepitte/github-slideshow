import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { deleteCalendarEvent } from "@/lib/google";

export const dynamic = "force-dynamic";

const STATUSES = ["a_faire", "devis_envoye", "gagne", "perdu", "annule"];

// PATCH /api/admin/bookings/:id { status } — met à jour le statut d'un RDV.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  let status = "";
  try {
    status = String((await req.json()).status ?? "");
  } catch {}
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }
  const booking = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!booking) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  if (status === "annule" && booking.status !== "annule") {
    const settings = await getSettings();
    await deleteCalendarEvent(settings, booking.googleEventId);
  }
  const updated = await prisma.booking.update({
    where: { id: params.id },
    data: { status, ...(status === "annule" ? { cancelledAt: new Date() } : {}) },
  });
  return NextResponse.json({ booking: updated });
}
