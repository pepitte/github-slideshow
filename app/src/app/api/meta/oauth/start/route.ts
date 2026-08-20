import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { metaAuthUrl, metaConfigured } from "@/lib/meta";
import { requestBaseUrl } from "@/lib/templates";

export const dynamic = "force-dynamic";

// GET /api/meta/oauth/start — envoie le gérant sur la page de connexion Facebook.
export async function GET() {
  // Le domaine d'où vient le clic : l'aller-retour OAuth doit y revenir,
  // sinon la session du gérant est perdue en route.
  const base = requestBaseUrl(headers());
  if (!isAdminAuthenticated()) {
    return NextResponse.redirect(`${base}/admin/login`);
  }
  const settings = await getSettings();
  if (!metaConfigured(settings)) {
    return NextResponse.redirect(`${base}/admin/meta?meta=non_configure`);
  }
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(metaAuthUrl(settings, base, state));
  // Protection CSRF : l'état renvoyé par Meta doit correspondre au cookie.
  res.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
