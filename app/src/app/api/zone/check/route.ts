import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { checkZone } from "@/lib/zone";

export const dynamic = "force-dynamic";

// POST /api/zone/check { postalCode, address? } → { covered }
export async function POST(req: NextRequest) {
  try {
    const { postalCode, address } = await req.json();
    if (!postalCode) {
      return NextResponse.json({ error: "postalCode requis" }, { status: 400 });
    }
    const settings = await getSettings();
    const result = await checkZone(settings, String(postalCode), address);
    return NextResponse.json({ covered: result.covered, reason: result.reason ?? null });
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
}
