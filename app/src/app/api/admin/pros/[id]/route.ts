import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

// DELETE /api/admin/pros/:id — retire un professionnel (ses pointages suivent).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    await prisma.pro.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }
}
