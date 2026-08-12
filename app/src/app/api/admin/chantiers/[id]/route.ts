import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_GALERIE = 6;

function photos(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((p) => typeof p === "string") : [];
  } catch {
    return [];
  }
}

/**
 * PATCH /api/admin/chantiers/:id — { validated } marque le rapport comme
 * terminé ; { publier } met la photo « après » en vitrine sur la page
 * d'accueil (ou l'en retire).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const journee = await prisma.workEntry.findUnique({ where: { id: params.id } });
  if (!journee) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  if (body.validated !== undefined) {
    await prisma.workEntry.update({
      where: { id: params.id },
      data: { validated: Boolean(body.validated) },
    });
  }

  if (body.publier !== undefined) {
    const apres = photos(journee.photosAfterJson);
    if (!apres.length) {
      return NextResponse.json(
        { error: "Ce rapport n'a pas de photo « après » à mettre en vitrine." },
        { status: 400 }
      );
    }
    const photo = apres[0];
    const existante = await prisma.galleryPhoto.findFirst({ where: { dataUrl: photo } });
    if (body.publier) {
      if (!existante) {
        const nb = await prisma.galleryPhoto.count();
        if (nb >= MAX_GALERIE) {
          return NextResponse.json(
            {
              error: `La vitrine est pleine (${MAX_GALERIE} photos). Retirez-en une depuis Paramètres → Photos de réalisations.`,
            },
            { status: 400 }
          );
        }
        await prisma.galleryPhoto.create({ data: { dataUrl: photo, sort: nb } });
      }
    } else if (existante) {
      await prisma.galleryPhoto.delete({ where: { id: existante.id } });
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/chantiers/:id — supprime UNIQUEMENT les photos du rapport.
 * Les heures pointées de la journée sont conservées : elles servent à la paie
 * et à la facturation des sous-traitants.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const journee = await prisma.workEntry.findUnique({ where: { id: params.id } });
  if (!journee) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  // Les photos mises en vitrine depuis ce rapport sont retirées avec lui.
  for (const p of photos(journee.photosAfterJson)) {
    await prisma.galleryPhoto.deleteMany({ where: { dataUrl: p } });
  }
  await prisma.workEntry.update({
    where: { id: params.id },
    data: { photosBeforeJson: "[]", photosAfterJson: "[]" },
  });
  return NextResponse.json({ ok: true });
}
