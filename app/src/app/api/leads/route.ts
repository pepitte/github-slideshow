import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { creerOuCompleterContact, journaliser, splitNom } from "@/lib/contacts";

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
  const email = String(body.email ?? "").trim();
  const postalCode = String(body.postalCode ?? "").trim();
  const message = String(body.message ?? "").slice(0, 2000);
  await prisma.lead.create({ data: { name, phone, email, postalCode, message } });

  // Le prospect entre aussi dans la base globale : même hors zone, il ne doit
  // pas se perdre.
  const contact = await creerOuCompleterContact({
    ...splitNom(name),
    phone,
    email,
    postalCode,
    origine: "site",
  });
  await journaliser(contact.id, "note", message || "Demande via le formulaire de contact.", {
    sens: "entrant",
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
