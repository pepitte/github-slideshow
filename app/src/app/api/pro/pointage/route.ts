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

// GET /api/pro/pointage — la journée du jour (arrivée / départ pointés).
export async function GET() {
  const proId = currentProId();
  if (!proId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const entry = await prisma.workEntry.findUnique({
    where: { proId_date: { proId, date: parisToday() } },
  });
  return NextResponse.json({
    date: parisToday(),
    arrival: entry?.arrival ?? "",
    departure: entry?.departure ?? "",
    validated: entry?.validated ?? false,
  });
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
  const date = parisToday();
  const now = parisNow();
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
