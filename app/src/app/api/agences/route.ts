import { NextResponse } from "next/server";
import { agencesActives } from "@/lib/agences";

export const dynamic = "force-dynamic";

// GET /api/agences — liste publique et minimale des secteurs, pour le
// sélecteur de l'inscription professionnelle. Aucune donnée sensible.
export async function GET() {
  const agences = await agencesActives();
  return NextResponse.json({
    agences: agences.map((a) => ({ id: a.id, nom: a.nom, city: a.city, postalCode: a.postalCode })),
  });
}
