import { NextRequest, NextResponse } from "next/server";
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
    client: {
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address,
      postalCode: client.postalCode,
      city: client.city,
    },
    bookings,
  });
}

// PATCH /api/client/me — le particulier met à jour ses coordonnées et son adresse
// (les comptes créés avant l'ajout de l'adresse peuvent ainsi la renseigner).
export async function PATCH(req: NextRequest) {
  const id = currentClientId();
  if (!id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const address = String(body.address ?? "").trim();
  const postalCode = String(body.postalCode ?? "").trim();
  const city = String(body.city ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  }
  if (!address || !/^\d{5}$/.test(postalCode)) {
    return NextResponse.json(
      { error: "Adresse et code postal (5 chiffres) requis" },
      { status: 400 }
    );
  }
  const client = await prisma.client.update({
    where: { id },
    data: { name, phone, address, postalCode, city },
  });
  return NextResponse.json({
    ok: true,
    client: {
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address,
      postalCode: client.postalCode,
      city: client.city,
    },
  });
}
