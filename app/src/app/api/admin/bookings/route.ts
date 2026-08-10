import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { parisTimeToUtc } from "@/lib/dates";

export const dynamic = "force-dynamic";

// Au-delà, on ne charge pas tout : le tableau de bord doit rester rapide même
// après des centaines de rendez-vous.
const MAX_RESULTATS = 200;

/**
 * GET /api/admin/bookings?past=1&q=… — liste des RDV du tableau de bord.
 *
 * Les photos ne sont JAMAIS renvoyées ici (ce sont des images en base64, très
 * lourdes) : seul leur nombre l'est, et la fiche les charge à son ouverture.
 * Par défaut on ne renvoie que les RDV utiles au quotidien (à venir, plus les
 * devis sans date) ; `past=1` remonte l'historique et `q` cherche dans tout.
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const past = req.nextUrl.searchParams.get("past") === "1";
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const depuis = new Date(Date.now() - 24 * 3600_000);

  // Recherche ou historique demandé → on ouvre la fenêtre à tout l'historique.
  const fenetre =
    past || q
      ? {}
      : { OR: [{ startAt: { gte: depuis } }, { startAt: null }] };

  const recherche = q
    ? {
        OR: [
          { firstName: { contains: q, mode: "insensitive" as const } },
          { lastName: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { city: { contains: q, mode: "insensitive" as const } },
          { postalCode: { contains: q, mode: "insensitive" as const } },
          { address: { contains: q, mode: "insensitive" as const } },
          { description: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const where = { AND: [fenetre, recherche] };

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { startAt: "asc" },
      take: MAX_RESULTATS,
      include: {
        // Le nombre de photos suffit à la liste ; les images arrivent au clic.
        _count: { select: { photos: true } },
        pro: { select: { id: true, name: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  const pros = await prisma.pro.findMany({
    select: { id: true, name: true, basePostalCode: true, radiusKm: true, datesJson: true },
    orderBy: { name: "asc" },
  });
  // Les prospects venus des publicités ont leur propre section (Publicités Meta).
  const leads = await prisma.lead.findMany({
    where: { source: "site" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({
    bookings: bookings.map(({ _count, ...b }) => ({ ...b, photosCount: _count.photos })),
    leads,
    pros,
    total,
    tronque: total > bookings.length,
  });
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
