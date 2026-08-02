import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentClientId } from "@/lib/clientAuth";

export const dynamic = "force-dynamic";

// GET /api/client/me — profil + rendez-vous du particulier connecté
// (rattachés par email, y compris les réservations faites sans compte).
export async function GET() {
  const id = currentClientId();
  if (!id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const bookings = await prisma.booking.findMany({
    where: { email: client.email },
    orderBy: { startAt: "desc" },
    select: {
      id: true,
      kind: true,
      projectType: true,
      startAt: true,
      address: true,
      postalCode: true,
      city: true,
      status: true,
      cancelToken: true,
    },
  });

  return NextResponse.json({
    client: { name: client.name, email: client.email, phone: client.phone },
    bookings,
  });
}
