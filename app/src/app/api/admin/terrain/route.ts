import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

function parisToday(): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// GET /api/admin/terrain?from=&to= — pointages des pros sur la période
// (les dates AAAA-MM-JJ se comparent alphabétiquement).
export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const today = parisToday();
  const fromParam = req.nextUrl.searchParams.get("from") ?? "";
  const toParam = req.nextUrl.searchParams.get("to") ?? "";
  const from = /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam : today;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? toParam : from;

  const [entries, pros] = await Promise.all([
    prisma.workEntry.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.pro.findMany({
      select: { id: true, name: true, phone: true, baseCity: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return NextResponse.json({ from, to, entries, pros });
}

// PATCH /api/admin/terrain { id, validated } — valide (ou dévalide) une journée.
export async function PATCH(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (body.validated !== undefined) data.validated = Boolean(body.validated);
  // Le gérant peut corriger une heure oubliée ou erronée ("" pour effacer).
  for (const champ of ["arrival", "departure"] as const) {
    if (body[champ] === undefined) continue;
    const v = String(body[champ] ?? "").trim();
    if (v && !/^\d{2}:\d{2}$/.test(v)) {
      return NextResponse.json({ error: "Heure invalide (format HH:mm)" }, { status: 400 });
    }
    data[champ] = v;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400 });
  }
  try {
    const entry = await prisma.workEntry.update({ where: { id }, data });
    return NextResponse.json({ ok: true, entry });
  } catch {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }
}

// POST /api/admin/terrain { proId, date } — crée une journée vide que le
// gérant peut ensuite renseigner (pro ayant oublié de pointer).
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
  const proId = String(body.proId ?? "");
  const date = String(body.date ?? "");
  if (!proId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Professionnel et date requis" }, { status: 400 });
  }
  const entry = await prisma.workEntry.upsert({
    where: { proId_date: { proId, date } },
    update: {},
    create: { proId, date },
  });
  return NextResponse.json({ ok: true, entry }, { status: 201 });
}
