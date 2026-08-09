import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentProId } from "@/lib/proAuth";

export const dynamic = "force-dynamic";

function parisToday(): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function parisNow(): string {
  return new Date().toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parsePhotos(json: string | undefined): string[] {
  try {
    const arr = JSON.parse(json || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Date demandée (AAAA-MM-JJ) : aujourd'hui ou l'un des 7 jours précédents. */
function requestedDate(v: unknown): string | null {
  const d = String(v ?? "").trim();
  if (!d) return parisToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const today = parisToday();
  if (d > today) return null; // pas de pointage dans le futur
  const limit = new Date(`${today}T12:00:00`);
  limit.setDate(limit.getDate() - 7);
  return d >= limit.toISOString().slice(0, 10) ? d : null;
}

// GET /api/pro/pointage?date=AAAA-MM-JJ — la journée demandée (défaut : aujourd'hui).
export async function GET(req: NextRequest) {
  const proId = currentProId();
  if (!proId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const date = requestedDate(req.nextUrl.searchParams.get("date"));
  if (!date) return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  const entry = await prisma.workEntry.findUnique({
    where: { proId_date: { proId, date } },
  });
  return NextResponse.json({
    date,
    arrival: entry?.arrival ?? "",
    departure: entry?.departure ?? "",
    validated: entry?.validated ?? false,
    photosBefore: parsePhotos(entry?.photosBeforeJson),
    photosAfter: parsePhotos(entry?.photosAfterJson),
  });
}

// PUT /api/pro/pointage { photosBefore, photosAfter } — photos avant/après du chantier.
export async function PUT(req: NextRequest) {
  const proId = currentProId();
  if (!proId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const date = requestedDate(body.date);
  if (!date) return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  const clean = (v: unknown): string[] =>
    (Array.isArray(v) ? v : [])
      .filter((p): p is string => typeof p === "string" && p.startsWith("data:image/") && p.length < 2_000_000)
      .slice(0, 4);
  const photosBefore = clean(body.photosBefore);
  const photosAfter = clean(body.photosAfter);
  await prisma.workEntry.upsert({
    where: { proId_date: { proId, date } },
    update: {
      photosBeforeJson: JSON.stringify(photosBefore),
      photosAfterJson: JSON.stringify(photosAfter),
    },
    create: {
      proId,
      date,
      photosBeforeJson: JSON.stringify(photosBefore),
      photosAfterJson: JSON.stringify(photosAfter),
    },
  });
  return NextResponse.json({ ok: true, photosBefore, photosAfter });
}

// POST /api/pro/pointage { action: "arrivee" | "depart" } — pointe à l'heure de Paris.
export async function POST(req: NextRequest) {
  const proId = currentProId();
  if (!proId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const action = String(body.action ?? "");
  if (action !== "arrivee" && action !== "depart") {
    return NextResponse.json({ error: "action invalide" }, { status: 400 });
  }
  const date = requestedDate(body.date);
  if (!date) {
    return NextResponse.json({ error: "Date invalide (7 jours maximum en arrière)" }, { status: 400 });
  }
  // Heure fournie (rattrapage) ou heure actuelle
  const given = String(body.time ?? "").trim();
  if (given && !/^\d{2}:\d{2}$/.test(given)) {
    return NextResponse.json({ error: "Heure invalide" }, { status: 400 });
  }
  const now = given || parisNow();
  const patch = action === "arrivee" ? { arrival: now } : { departure: now };
  const entry = await prisma.workEntry.upsert({
    where: { proId_date: { proId, date } },
    update: patch,
    create: { proId, date, ...patch },
  });
  return NextResponse.json({
    ok: true,
    date,
    arrival: entry.arrival,
    departure: entry.departure,
  });
}
