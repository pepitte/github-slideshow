import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { parisTimeToUtc } from "@/lib/dates";

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
  // Les prospects venus des publicités ont leur propre section (Publicités Meta).
  const leads = await prisma.lead.findMany({
    where: { source: "site" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ bookings, leads });
}

/** Photos valides : data URLs image, 10 max. */
function cleanPhotos(v: unknown): string[] {
  return (Array.isArray(v) ? v : [])
    .filter((p): p is string => typeof p === "string" && p.startsWith("data:image/") && p.length < 2_000_000)
    .slice(0, 10);
}

// POST /api/admin/bookings — devis créé à la main par le gérant (client au
// téléphone, prospect rencontré sur place…). Tous les champs sont optionnels ;
// sans date choisie, le devis reste « sans date » (startAt null).
export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const s = (k: string) => String(body[k] ?? "").trim();
  const firstName = s("firstName");
  const lastName = s("lastName");
  const phone = s("phone");
  const email = s("email");
  const address = s("address");
  const postalCode = s("postalCode");
  const city = s("city");
  const description = s("description");
  const dateKey = s("date"); // AAAA-MM-JJ (facultatif)
  const time = s("time"); // HH:mm (facultatif)
  const photos = cleanPhotos(body.photos);

  // Garde-fou : au moins une information.
  const hasInfo =
    [firstName, lastName, phone, email, address, postalCode, city, description, dateKey].some(Boolean) ||
    photos.length > 0;
  if (!hasInfo) {
    return NextResponse.json({ error: "Renseignez au moins une information" }, { status: 400 });
  }
  // Validation souple : uniquement si le champ est rempli.
  if (email && !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }
  if (phone && !/^(\+33|0)[\d\s.\-]{8,}$/.test(phone)) {
    return NextResponse.json({ error: "Téléphone invalide (format français)" }, { status: 400 });
  }

  let startAt: Date | null = null;
  let endAt: Date | null = null;
  if (dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !/^\d{2}:\d{2}$/.test(time || "")) {
      return NextResponse.json({ error: "Date ou heure invalide" }, { status: 400 });
    }
    const settings = await getSettings();
    startAt = parisTimeToUtc(dateKey, time);
    endAt = new Date(startAt.getTime() + settings.visitDurationMin * 60_000);
  }

  const booking = await prisma.booking.create({
    data: {
      firstName,
      lastName,
      phone,
      email,
      address,
      postalCode,
      city,
      description,
      kind: "devis",
      source: "manual",
      projectType: "autre",
      startAt,
      endAt,
      photos: { create: photos.map((dataUrl) => ({ dataUrl })) },
    },
    include: { photos: { select: { id: true, dataUrl: true } } },
  });
  return NextResponse.json({ ok: true, booking }, { status: 201 });
}
