import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { getAvailability } from "@/lib/availability";

export const dynamic = "force-dynamic";

// GET /api/availability → [{ date: "2026-07-15", slots: ["...ISO..."] }]
export async function GET() {
  const settings = await getSettings();
  const days = await getAvailability(settings);
  return NextResponse.json({ days, visitDurationMin: settings.visitDurationMin });
}
