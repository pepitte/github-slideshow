import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/leads — contact laissé par un prospect hors zone d'intervention.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  if (!name || !phone) {
    return NextResponse.json({ error: "Nom et téléphone requis" }, { status: 400 });
  }
  await prisma.lead.create({
    data: {
      name,
      phone,
      email: String(body.email ?? "").trim(),
      postalCode: String(body.postalCode ?? "").trim(),
      message: String(body.message ?? "").slice(0, 2000),
    },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
