import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** "08:30" → 510 minutes ; format invalide → null */
function minutesOf(hm: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(hm)) return null;
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

/** Échappe une cellule pour un CSV lisible par Excel (séparateur ;). */
function cell(value: string | number): string {
  const s = String(value);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * GET /api/admin/terrain/export?from=&to= — heures pointées au format CSV,
 * prêt à ouvrir dans Excel (paie, facturation des sous-traitants).
 * Séparateur « ; » et BOM UTF-8 : Excel FR découpe les colonnes et garde les accents.
 */
export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const p = req.nextUrl.searchParams;
  const valid = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const from = valid(p.get("from"));
  const to = valid(p.get("to"));
  if (!from || !to) {
    return NextResponse.json({ error: "Période invalide" }, { status: 400 });
  }

  const [entries, pros] = await Promise.all([
    prisma.workEntry.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: [{ date: "asc" }],
    }),
    prisma.pro.findMany({ select: { id: true, name: true, baseCity: true } }),
  ]);
  const proById = new Map(pros.map((pro) => [pro.id, pro]));

  const rows: string[] = [
    ["Date", "Professionnel", "Ville", "Arrivée", "Départ", "Heures (h:mm)", "Heures (décimal)", "Statut"]
      .map(cell)
      .join(";"),
  ];
  let totalMinutes = 0;

  for (const e of entries) {
    const pro = proById.get(e.proId);
    const a = minutesOf(e.arrival);
    const d = minutesOf(e.departure);
    const mins = a !== null && d !== null && d > a ? d - a : 0;
    totalMinutes += mins;
    const statut = e.validated ? "Validée" : mins ? "Complet" : "Incomplet";
    rows.push(
      [
        e.date,
        pro?.name ?? "(professionnel retiré)",
        pro?.baseCity ?? "",
        e.arrival,
        e.departure,
        mins ? `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}` : "",
        // Virgule décimale : Excel FR l'interprète comme un nombre.
        mins ? (mins / 60).toFixed(2).replace(".", ",") : "",
        statut,
      ]
        .map(cell)
        .join(";")
    );
  }
  rows.push("");
  rows.push(
    ["", "TOTAL", "", "", "", `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")}`,
      (totalMinutes / 60).toFixed(2).replace(".", ","), ""]
      .map(cell)
      .join(";")
  );

  const csv = "﻿" + rows.join("\r\n");
  const name = from === to ? `pointages-${from}.csv` : `pointages-${from}_${to}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
