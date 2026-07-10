import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/admin/bookings — liste des RDV (photos incluses) pour le tableau de bord.
export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const bookings = await prisma.booking.findMany({
    orderBy: { startAt: "asc" },
    include: { photos: { select: { id: true, dataUrl: true } } },
  });
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ bookings, leads });
}
