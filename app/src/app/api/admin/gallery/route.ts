import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_PHOTOS = 3;

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const photos = await prisma.galleryPhoto.findMany({ orderBy: { sort: "asc" } });
  return NextResponse.json({ photos: photos.map((p) => p.dataUrl) });
}

// PUT /api/admin/gallery { photos: string[] } — remplace la galerie de la landing.
export async function PUT(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  let photos: unknown;
  try {
    photos = (await req.json()).photos;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!Array.isArray(photos) || photos.length > MAX_PHOTOS) {
    return NextResponse.json({ error: `${MAX_PHOTOS} photos maximum` }, { status: 400 });
  }
  for (const p of photos) {
    if (typeof p !== "string" || !p.startsWith("data:image/") || p.length > 2_500_000) {
      return NextResponse.json({ error: "Photo invalide (max ~1,8 Mo chacune)" }, { status: 400 });
    }
  }
  await prisma.$transaction([
    prisma.galleryPhoto.deleteMany({}),
    prisma.galleryPhoto.createMany({
      data: (photos as string[]).map((dataUrl, sort) => ({ dataUrl, sort })),
    }),
  ]);
  return NextResponse.json({ ok: true });
}
