import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { deleteCalendarEvent } from "@/lib/google";

export const dynamic = "force-dynamic";

const STATUSES = ["a_faire", "devis_envoye", "gagne", "perdu", "annule"];

// PATCH /api/admin/bookings/:id { status?, description?, photos? } —
// statut, notes ou photos (fiche du devis) mis à jour par le gérant.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {}
  const booking = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!booking) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const data: Record<string, unknown> = {};

  if (body.status !== undefined) {
    const status = String(body.status ?? "");
    if (!STATUSES.includes(status)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }
    if (status === "annule" && booking.status !== "annule") {
      const settings = await getSettings();
      await deleteCalendarEvent(settings, booking.googleEventId);
    }
    data.status = status;
    if (status === "annule") data.cancelledAt = new Date();
  }

  if (body.description !== undefined) {
    data.description = String(body.description ?? "").slice(0, 5000);
  }

  if (body.photos !== undefined) {
    const photos = (Array.isArray(body.photos) ? body.photos : [])
      .filter(
        (p): p is string =>
          typeof p === "string" && p.startsWith("data:image/") && p.length < 2_000_000
      )
      .slice(0, 10);
    await prisma.photo.deleteMany({ where: { bookingId: params.id } });
    data.photos = { create: photos.map((dataUrl) => ({ dataUrl })) };
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400 });
  }
  const updated = await prisma.booking.update({
    where: { id: params.id },
    data,
    include: { photos: { select: { id: true, dataUrl: true } } },
  });
  return NextResponse.json({ booking: updated });
}
