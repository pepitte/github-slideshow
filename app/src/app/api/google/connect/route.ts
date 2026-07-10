import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { authorizationUrl, googleConfigured } from "@/lib/google";
import { appUrl } from "@/lib/templates";

export const dynamic = "force-dynamic";

// GET /api/google/connect — redirige le gérant vers le consentement Google (OAuth 2.0).
export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.redirect(`${appUrl()}/admin/login`);
  }
  if (!googleConfigured()) {
    return NextResponse.redirect(`${appUrl()}/admin/parametres?google=non_configure`);
  }
  return NextResponse.redirect(authorizationUrl());
}
