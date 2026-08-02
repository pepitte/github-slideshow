import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/admin/pros — vue gérant de tous les professionnels et de leurs dispos.
export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const pros = await prisma.pro.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json({
    pros: pros.map(({ passwordHash, ...rest }) => rest),
  });
}
