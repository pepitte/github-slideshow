import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { exchangeCode, fetchGoogleEmail } from "@/lib/google";
import { getSettings } from "@/lib/settings";
import { appUrl } from "@/lib/templates";

export const dynamic = "force-dynamic";

// GET /api/google/callback?code=... — termine la connexion Google Agenda.
export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.redirect(`${appUrl()}/admin/login`);
  }
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${appUrl()}/admin/parametres?google=refuse`);
  }
  try {
    const tokens = await exchangeCode(code);
    const email = await fetchGoogleEmail(tokens.access_token);
    await getSettings();
    await prisma.settings.update({
      where: { id: "main" },
      data: {
        googleAccessToken: tokens.access_token,
        googleTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        ...(tokens.refresh_token ? { googleRefreshToken: tokens.refresh_token } : {}),
        googleEmail: email,
      },
    });
    return NextResponse.redirect(`${appUrl()}/admin/parametres?google=ok`);
  } catch (e) {
    console.error("Callback Google échoué:", e);
    return NextResponse.redirect(`${appUrl()}/admin/parametres?google=erreur`);
  }
}
