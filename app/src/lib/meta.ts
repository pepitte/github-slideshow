// Connexion au compte Meta (Facebook/Instagram) : récupération des leads
// laissés dans les formulaires publicitaires, via l'API Graph en REST direct.
//
// Deux chemins amènent un lead dans l'application :
//  1. le webhook `leadgen` (temps réel), quand Meta prévient le site ;
//  2. l'import manuel depuis l'admin (rattrape ce qui aurait été manqué).
// Les deux passent par `saveLead()`, qui déduplique sur l'identifiant Meta.
import crypto from "crypto";
import type { Settings } from "@prisma/client";
import { prisma } from "./prisma";
import { creerOuCompleterContact, journaliser, splitNom } from "./contacts";

const GRAPH = "https://graph.facebook.com/v21.0";

/** Permissions demandées à la connexion du compte Meta. */
export const META_SCOPES = [
  "pages_show_list",
  "pages_manage_metadata",
  "leads_retrieval",
  "business_management",
].join(",");

export function metaConfigured(s: Settings): boolean {
  return Boolean(s.metaAppId && s.metaAppSecret);
}

export function metaRedirectUri(appUrl: string): string {
  return `${appUrl}/api/meta/oauth/callback`;
}

/** Page de connexion Facebook (l'utilisateur choisit sa page). */
export function metaAuthUrl(s: Settings, appUrl: string, state: string): string {
  const params = new URLSearchParams({
    client_id: s.metaAppId,
    redirect_uri: metaRedirectUri(appUrl),
    state,
    scope: META_SCOPES,
    response_type: "code",
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
}

async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`${GRAPH}/${path}?${new URLSearchParams(params)}`, {
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Erreur Meta (${res.status})`);
  }
  return data as T;
}

/** Code OAuth → jeton utilisateur longue durée (≈ 60 jours). */
export async function exchangeCodeForToken(
  s: Settings,
  appUrl: string,
  code: string
): Promise<string> {
  const short = await graph<{ access_token: string }>("oauth/access_token", {
    client_id: s.metaAppId,
    client_secret: s.metaAppSecret,
    redirect_uri: metaRedirectUri(appUrl),
    code,
  });
  const long = await graph<{ access_token: string }>("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: s.metaAppId,
    client_secret: s.metaAppSecret,
    fb_exchange_token: short.access_token,
  });
  return long.access_token;
}

export type MetaPage = { id: string; name: string; access_token: string };

export async function listPages(userToken: string): Promise<MetaPage[]> {
  const data = await graph<{ data: MetaPage[] }>("me/accounts", {
    access_token: userToken,
    fields: "id,name,access_token",
    limit: "50",
  });
  return data.data ?? [];
}

/** Abonne l'application aux nouveaux leads de la page (webhook temps réel). */
export async function subscribePageToLeads(page: MetaPage): Promise<void> {
  const res = await fetch(`${GRAPH}/${page.id}/subscribed_apps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscribed_fields: "leadgen",
      access_token: page.access_token,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Abonnement à la page refusé");
}

type MetaLead = {
  id: string;
  created_time?: string;
  ad_name?: string;
  campaign_name?: string;
  form_id?: string;
  field_data?: { name: string; values: string[] }[];
};

export async function fetchLead(leadId: string, pageToken: string): Promise<MetaLead> {
  return graph<MetaLead>(leadId, {
    access_token: pageToken,
    fields: "id,created_time,ad_name,campaign_name,form_id,field_data",
  });
}

/** Formulaires publicitaires de la page (pour l'import manuel). */
export async function listForms(
  pageId: string,
  pageToken: string
): Promise<{ id: string; name: string }[]> {
  const data = await graph<{ data: { id: string; name: string }[] }>(
    `${pageId}/leadgen_forms`,
    { access_token: pageToken, fields: "id,name", limit: "50" }
  );
  return data.data ?? [];
}

export async function fetchFormLeads(formId: string, pageToken: string): Promise<MetaLead[]> {
  const data = await graph<{ data: MetaLead[] }>(`${formId}/leads`, {
    access_token: pageToken,
    fields: "id,created_time,ad_name,campaign_name,form_id,field_data",
    limit: "100",
  });
  return data.data ?? [];
}

/** Signature du webhook (X-Hub-Signature-256) : le corps vient bien de Meta. */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=") || !appSecret) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const given = header.slice(7);
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Les formulaires Meta nomment leurs champs en anglais (full_name, phone_number…)
// mais un formulaire personnalisé peut utiliser des libellés français.
const FIELD_ALIASES: Record<string, string[]> = {
  name: ["full_name", "nom_complet", "name", "nom", "prenom", "prénom"],
  phone: ["phone_number", "telephone", "téléphone", "tel", "numero", "numéro", "phone"],
  email: ["email", "e_mail", "courriel", "mail"],
  postalCode: ["post_code", "postal_code", "zip_code", "code_postal", "cp", "postcode"],
  message: ["message", "projet", "besoin", "commentaire", "precisions", "précisions"],
};

function pick(fields: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = fields[k];
    if (v) return v;
  }
  return "";
}

/** Transforme les réponses Meta en prospect exploitable. */
export function parseLead(lead: MetaLead, formName = "") {
  const fields: Record<string, string> = {};
  for (const f of lead.field_data ?? []) {
    fields[f.name.toLowerCase()] = (f.values ?? []).join(", ");
  }
  // Meta sépare souvent prénom et nom : les recoller avant les autres libellés.
  const complet = `${fields["first_name"] ?? ""} ${fields["last_name"] ?? ""}`.trim();
  const name = fields["full_name"] || complet || pick(fields, FIELD_ALIASES.name);
  return {
    externalId: lead.id,
    name: name || "Prospect Facebook",
    phone: pick(fields, FIELD_ALIASES.phone),
    email: pick(fields, FIELD_ALIASES.email),
    postalCode: pick(fields, FIELD_ALIASES.postalCode),
    message: pick(fields, FIELD_ALIASES.message),
    formName,
    adName: lead.ad_name ?? "",
    campaign: lead.campaign_name ?? "",
    rawJson: JSON.stringify(fields),
    createdAt: lead.created_time ? new Date(lead.created_time) : undefined,
  };
}

/** Enregistre un prospect Meta, sans jamais créer de doublon. */
export async function saveLead(parsed: ReturnType<typeof parseLead>): Promise<boolean> {
  const existing = await prisma.lead.findFirst({ where: { externalId: parsed.externalId } });
  if (existing) return false;
  const { createdAt, ...rest } = parsed;
  await prisma.lead.create({
    data: { ...rest, source: "meta", ...(createdAt ? { createdAt } : {}) },
  });
  // Les prospects publicitaires entrent aussi dans la base globale.
  const contact = await creerOuCompleterContact({
    ...splitNom(rest.name),
    phone: rest.phone,
    email: rest.email,
    postalCode: rest.postalCode,
    origine: "meta",
  });
  await journaliser(
    contact.id,
    "note",
    [rest.message, rest.adName && `Publicité : ${rest.adName}`, rest.campaign && `Campagne : ${rest.campaign}`]
      .filter(Boolean)
      .join("\n") || "Prospect issu d'une publicité.",
    { sens: "entrant" }
  );
  return true;
}
