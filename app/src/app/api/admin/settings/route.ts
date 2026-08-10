import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { geocode } from "@/lib/zone";
import { googleConfigured } from "@/lib/google";
import { emailConfigured, usingTestSender } from "@/lib/email";

export const dynamic = "force-dynamic";

function sanitize(settings: Awaited<ReturnType<typeof getSettings>>) {
  // Ne jamais exposer les tokens OAuth au navigateur.
  const { googleRefreshToken, googleAccessToken, googleTokenExpiry, ...rest } = settings;
  return {
    ...rest,
    googleConnected: Boolean(googleRefreshToken),
    googleConfigured: googleConfigured(),
    // Diagnostic des emails clients : la clé est-elle là, et un expéditeur
    // vérifié est-il renseigné ? Sans lui, seul le gérant reçoit ses alertes.
    emailConfigured: emailConfigured(),
    emailClientsOk: emailConfigured() && !usingTestSender(settings.emailFrom),
  };
}

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  return NextResponse.json({ settings: sanitize(await getSettings()) });
}

// PUT /api/admin/settings — met à jour les réglages (horaires, zones, textes, branding...).
export async function PUT(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : undefined);
  const num = (k: string) => {
    const v = Number(body[k]);
    return Number.isFinite(v) ? Math.round(v) : undefined;
  };
  const json = (k: string) => {
    if (body[k] === undefined) return undefined;
    try {
      return JSON.stringify(body[k]);
    } catch {
      return undefined;
    }
  };

  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries({
    companyName: str("companyName"),
    companyPhone: str("companyPhone"),
    companyEmail: str("companyEmail"),
    baseAddress: str("baseAddress"),
    basePostalCode: str("basePostalCode"),
    logoUrl: str("logoUrl"),
    primaryColor: str("primaryColor"),
    zoneMode: ["postal", "radius"].includes(str("zoneMode") ?? "") ? str("zoneMode") : undefined,
    postalCodesJson: json("postalCodes"),
    radiusKm: num("radiusKm"),
    visitDurationMin: num("visitDurationMin"),
    bufferMin: num("bufferMin"),
    minNoticeHours: num("minNoticeHours"),
    maxDaysAhead: num("maxDaysAhead"),
    openingHoursJson: json("openingHours"),
    chantierEnabled: typeof body.chantierEnabled === "boolean" ? body.chantierEnabled : undefined,
    chantierDurationMin: num("chantierDurationMin"),
    chantierHoursJson: json("chantierHours"),
    daysOffJson: json("daysOff"),
    notifyOwnerEmail: typeof body.notifyOwnerEmail === "boolean" ? body.notifyOwnerEmail : undefined,
    notifyOwnerSms: typeof body.notifyOwnerSms === "boolean" ? body.notifyOwnerSms : undefined,
    ownerEmail: str("ownerEmail"),
    ownerPhone: str("ownerPhone"),
    emailFrom: str("emailFrom"),
    proFilterMode: ["off", "chantier", "tous"].includes(str("proFilterMode") ?? "")
      ? str("proFilterMode")
      : undefined,
    smsConfirmation: str("smsConfirmation"),
    smsReminder24h: str("smsReminder24h"),
    smsReminder1h: str("smsReminder1h"),
    emailSubject: str("emailSubject"),
    emailBody: str("emailBody"),
    googleCalendarId: str("googleCalendarId"),
  })) {
    if (value !== undefined) data[key] = value;
  }

  // En mode rayon, géocoder l'adresse de base pour le calcul de distance.
  const baseAddress = str("baseAddress");
  if (baseAddress && (str("zoneMode") === "radius" || body.zoneMode === undefined)) {
    const point = await geocode(baseAddress);
    if (point) {
      data.baseLat = point.lat;
      data.baseLng = point.lng;
    }
  }

  await getSettings(); // garantit l'existence de la ligne
  const updated = await prisma.settings.update({ where: { id: "main" }, data });
  return NextResponse.json({ settings: sanitize(updated) });
}
