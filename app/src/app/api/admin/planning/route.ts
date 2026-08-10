import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { parisTimeToUtc, addDaysStr } from "@/lib/dates";

export const dynamic = "force-dynamic";

// GET /api/admin/planning?month=2026-08 (ou ?from=2026-08-03&to=2026-08-09) —
// vue patron : RDV clients de la période + disponibilités déclarées par les pros.
export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const fromParam = req.nextUrl.searchParams.get("from") ?? "";
  const toParam = req.nextUrl.searchParams.get("to") ?? "";
  const monthParam = req.nextUrl.searchParams.get("month") ?? "";

  let rangeStart: Date;
  let rangeEnd: Date;
  let month = monthParam;
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromParam) && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
    rangeStart = parisTimeToUtc(fromParam, "00:00");
    rangeEnd = parisTimeToUtc(addDaysStr(toParam, 1), "00:00");
    month = fromParam.slice(0, 7);
  } else {
    month = /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam
      : new Date().toISOString().slice(0, 7);
    const firstDay = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    rangeStart = parisTimeToUtc(firstDay, "00:00");
    rangeEnd = parisTimeToUtc(addDaysStr(`${month}-${String(daysInMonth).padStart(2, "0")}`, 1), "00:00");
  }

  const [bookings, pros] = await Promise.all([
    prisma.booking.findMany({
      where: {
        status: { not: "annule" },
        startAt: { gte: rangeStart, lt: rangeEnd },
      },
      orderBy: { startAt: "asc" },
      select: {
        id: true,
        kind: true,
        firstName: true,
        lastName: true,
        phone: true,
        city: true,
        projectType: true,
        startAt: true,
        endAt: true,
        status: true,
        groupId: true,
      },
    }),
    prisma.pro.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        radiusKm: true,
        baseCity: true,
        datesJson: true,
        devisDispoJson: true,
      },
    }),
  ]);

  return NextResponse.json({ month, bookings, pros });
}
