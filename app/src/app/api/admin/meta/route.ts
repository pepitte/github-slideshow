import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { headers } from "next/headers";
import { requestBaseUrl } from "@/lib/templates";
import { metaRedirectUri } from "@/lib/meta";

export const dynamic = "force-dynamic";

/** État de la connexion Meta — aucun jeton n'est renvoyé au navigateur. */
async function status() {
  // Les adresses montrées doivent être celles du domaine consulté : c'est
  // celui-là que Facebook doit autoriser et appeler.
  const site = requestBaseUrl(headers());
  const s = await getSettings();
  const [leads, aTraiter] = await Promise.all([
    prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.lead.count({ where: { handled: false } }),
  ]);
  return {
    appId: s.metaAppId,
    appSecretSet: Boolean(s.metaAppSecret),
    pixelId: s.metaPixelId,
    pageId: s.metaPageId,
    pageName: s.metaPageName,
    pageConnected: Boolean(s.metaPageToken),
    accountConnected: Boolean(s.metaUserToken),
    connectedAt: s.metaConnectedAt,
    leadsEnabled: s.metaLeadsEnabled,
    verifyToken: s.metaVerifyToken,
    webhookAt: s.metaWebhookAt,
    webhookUrl: `${site}/api/meta/webhook`,
    // Facebook refuse la connexion si cette adresse n'est pas déclarée dans
    // « Facebook Login → Valid OAuth Redirect URIs » : il faut la montrer.
    redirectUri: metaRedirectUri(site),
    leads,
    aTraiter,
  };
}

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  return NextResponse.json(await status());
}

// PUT /api/admin/meta — identifiants de l'application Meta, pixel, activation.
// Un champ secret laissé vide n'efface pas la valeur enregistrée.
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
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : undefined);

  const data: Record<string, unknown> = {};
  const appId = str("appId");
  if (appId !== undefined) data.metaAppId = appId;
  const pixelId = str("pixelId");
  if (pixelId !== undefined) data.metaPixelId = pixelId;
  const secret = str("appSecret");
  if (secret) data.metaAppSecret = secret;
  if (typeof body.leadsEnabled === "boolean") data.metaLeadsEnabled = body.leadsEnabled;

  // Le jeton de vérification du webhook est généré une fois pour toutes.
  const current = await getSettings();
  if (!current.metaVerifyToken) data.metaVerifyToken = crypto.randomBytes(16).toString("hex");

  await prisma.settings.update({ where: { id: "main" }, data });
  return NextResponse.json(await status());
}

// DELETE /api/admin/meta — déconnecte le compte Meta (les prospects sont conservés).
export async function DELETE() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  await prisma.settings.update({
    where: { id: "main" },
    data: {
      metaUserToken: "",
      metaPageId: "",
      metaPageName: "",
      metaPageToken: "",
      metaConnectedAt: null,
    },
  });
  return NextResponse.json(await status());
}
