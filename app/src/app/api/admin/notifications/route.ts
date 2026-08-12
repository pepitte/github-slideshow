import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { listerNotifications, marquerToutLu } from "@/lib/notificationsAdmin";

export const dynamic = "force-dynamic";

/** GET /api/admin/notifications — la cloche : ce qui attend le gérant. */
export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  return NextResponse.json(await listerNotifications());
}

/** POST /api/admin/notifications — « Tout marquer comme lu ». */
export async function POST() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  await marquerToutLu();
  return NextResponse.json({ ok: true });
}
