import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentProId, PRO_STATUSES } from "@/lib/proAuth";

export const dynamic = "force-dynamic";

function sanitize(pro: NonNullable<Awaited<ReturnType<typeof prisma.pro.findUnique>>>) {
  const { passwordHash, ...rest } = pro;
  return rest;
}

// GET /api/pro/me — profil + disponibilités du pro connecté.
export async function GET() {
  const id = currentProId();
  if (!id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const pro = await prisma.pro.findUnique({ where: { id } });
  if (!pro) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  return NextResponse.json({ pro: sanitize(pro) });
}

// PUT /api/pro/me — met à jour statut, dates, nombre de jours, rayon, coordonnées.
export async function PUT(req: NextRequest) {
  const id = currentProId();
  if (!id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.phone === "string") data.phone = body.phone.trim();
  if (typeof body.baseCity === "string") data.baseCity = body.baseCity.trim();
  if (typeof body.basePostalCode === "string") data.basePostalCode = body.basePostalCode.trim();
  if (typeof body.note === "string") data.note = body.note.slice(0, 1000);
  if (Number.isFinite(Number(body.radiusKm))) data.radiusKm = Math.max(0, Math.round(Number(body.radiusKm)));
  if (Number.isFinite(Number(body.availableDays)))
    data.availableDays = Math.max(0, Math.round(Number(body.availableDays)));
  if (typeof body.status === "string" && (PRO_STATUSES as readonly string[]).includes(body.status))
    data.status = body.status;
  if (Array.isArray(body.dates)) {
    const dates = (body.dates as unknown[])
      .filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))
      .slice(0, 366);
    data.datesJson = JSON.stringify(dates);
  }
  if (Array.isArray(body.devisSlots)) {
    const slots = (body.devisSlots as unknown[])
      .filter((s) => typeof s === "string" && /^\d{2}:\d{2}$/.test(s))
      .slice(0, 48);
    data.devisSlotsJson = JSON.stringify(slots);
  }

  const pro = await prisma.pro.update({ where: { id }, data });
  return NextResponse.json({ pro: sanitize(pro) });
}
