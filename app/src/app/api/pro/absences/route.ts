import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentProId } from "@/lib/proAuth";
import { MOTIFS_ABSENCE, absencesDe, validerIntervalle } from "@/lib/absences";

export const dynamic = "force-dynamic";

/** GET /api/pro/absences — mes congés et indisponibilités déclarés. */
export async function GET() {
  const proId = currentProId();
  if (!proId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  return NextResponse.json({ absences: await absencesDe(proId) });
}

/** POST /api/pro/absences { du, au, motif, note } — déclarer une absence. */
export async function POST(req: NextRequest) {
  const proId = currentProId();
  if (!proId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const du = String(body.du ?? "").trim();
  const au = String(body.au ?? du).trim();
  const erreur = validerIntervalle(du, au);
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 });

  const motif = MOTIFS_ABSENCE[String(body.motif)] ? String(body.motif) : "conges";
  const absence = await prisma.absence.create({
    data: { proId, du, au, motif, note: String(body.note ?? "").slice(0, 300) },
  });
  return NextResponse.json({ ok: true, absence, absences: await absencesDe(proId) }, { status: 201 });
}

/** DELETE /api/pro/absences?id=… — retirer une absence. */
export async function DELETE(req: NextRequest) {
  const proId = currentProId();
  if (!proId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const absence = await prisma.absence.findUnique({ where: { id } });
  if (!absence || absence.proId !== proId) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }
  await prisma.absence.delete({ where: { id } });
  return NextResponse.json({ ok: true, absences: await absencesDe(proId) });
}
