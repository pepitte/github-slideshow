import { NextRequest, NextResponse } from "next/server";

// Protège les pages /admin/* (hors /admin/login).
// La vérification HMAC complète est faite côté serveur dans chaque route API ;
// ici on vérifie simplement la présence/forme du cookie pour rediriger tôt.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const cookie = req.cookies.get("admin_session")?.value;
    if (!cookie || !cookie.includes(".")) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
