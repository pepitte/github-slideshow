import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { creerOuCompleterContact, journaliser, splitNom } from "@/lib/contacts";
import { notifyOwnerNewLead } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/leads/inbound — porte d'entrée « simple » pour les prospects.
 *
 * Pensée pour Zapier / Make branchés sur Facebook Lead Ads : ces services sont
 * déjà des partenaires validés par Meta, donc ils reçoivent les prospects sans
 * qu'on ait à faire valider notre propre application (« leads_retrieval »), ce
 * qui demande une revue Meta et une vérification d'entreprise.
 *
 * Volontairement tolérante sur les noms de champs : chaque outil envoie ce
 * qu'il veut, et un formulaire publicitaire français ne nomme pas ses champs
 * comme un formulaire anglais.
 */

const ALIAS: Record<string, string[]> = {
  name: ["name", "full_name", "fullname", "nom_complet", "nom complet", "nom"],
  firstName: ["first_name", "firstname", "prenom", "prénom"],
  lastName: ["last_name", "lastname", "nom_de_famille"],
  phone: ["phone", "phone_number", "telephone", "téléphone", "tel", "numero", "numéro", "mobile"],
  email: ["email", "e_mail", "mail", "courriel"],
  postalCode: ["postalcode", "postal_code", "post_code", "postcode", "zip", "zip_code", "code_postal", "cp"],
  message: ["message", "projet", "besoin", "commentaire", "precisions", "précisions", "demande"],
  externalId: ["externalid", "external_id", "id", "leadgen_id", "lead_id"],
  campaign: ["campaign", "campaign_name", "campagne"],
  adName: ["ad_name", "adname", "publicite", "publicité", "ad"],
  formName: ["form_name", "formname", "formulaire"],
};

/** Cherche une valeur quel que soit le libellé employé par l'outil source. */
function champ(plat: Record<string, string>, cle: keyof typeof ALIAS): string {
  for (const k of ALIAS[cle]) {
    const v = plat[k];
    if (v) return v.trim();
  }
  return "";
}

/** Aplatit l'objet reçu : Zapier imbrique volontiers ses champs. */
function aplatir(v: unknown, out: Record<string, string> = {}, profondeur = 0): Record<string, string> {
  if (profondeur > 4 || v === null || typeof v !== "object") return out;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const cle = k.toLowerCase().trim();
    if (val === null || val === undefined) continue;
    if (typeof val === "object") {
      // field_data façon Meta : [{ name: "phone_number", values: ["06…"] }].
      // On ne descend PAS dedans : ses clés « name » et « values » décrivent le
      // champ, elles ne sont pas la réponse — on lisait « full_name » comme nom
      // du prospect.
      const o = val as Record<string, unknown>;
      if (typeof o.name === "string" && Array.isArray(o.values)) {
        out[o.name.toLowerCase()] = o.values.join(", ");
        continue;
      }
      aplatir(val, out, profondeur + 1);
    } else if (out[cle] === undefined) {
      out[cle] = String(val);
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  const settings = await getSettings();
  if (!settings.leadsApiKey) {
    return NextResponse.json(
      { error: "Réception désactivée : générez la clé dans Publicités Meta." },
      { status: 503 }
    );
  }
  const fournie =
    req.nextUrl.searchParams.get("key") ??
    req.headers.get("x-api-key") ??
    (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const attendue = Buffer.from(settings.leadsApiKey);
  const donnee = Buffer.from(fournie ?? "");
  if (attendue.length !== donnee.length || !crypto.timingSafeEqual(attendue, donnee)) {
    return NextResponse.json({ error: "Clé invalide" }, { status: 401 });
  }

  let brut: unknown;
  try {
    brut = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const plat = aplatir(brut);

  const prenom = champ(plat, "firstName");
  const nom = champ(plat, "lastName");
  const nomComplet = champ(plat, "name") || `${prenom} ${nom}`.trim();
  const phone = champ(plat, "phone");
  const email = champ(plat, "email");
  if (!phone && !email) {
    return NextResponse.json(
      { error: "Un téléphone ou un email est nécessaire pour rappeler le prospect." },
      { status: 400 }
    );
  }

  // Sans identifiant fourni, on en fabrique un stable : un même prospect renvoyé
  // le même jour (réessai de Zapier) ne crée pas de doublon.
  const jour = new Date().toISOString().slice(0, 10);
  const externalId =
    champ(plat, "externalId") ||
    "auto-" +
      crypto
        .createHash("sha256")
        .update(`${phone}|${email}|${nomComplet}|${jour}`)
        .digest("hex")
        .slice(0, 24);

  const existant = await prisma.lead.findFirst({ where: { externalId } });
  if (existant) {
    return NextResponse.json({ ok: true, duplicate: true, id: existant.id });
  }

  const message = champ(plat, "message");
  const lead = await prisma.lead.create({
    data: {
      name: nomComplet || "Prospect",
      phone,
      email,
      postalCode: champ(plat, "postalCode"),
      message,
      source: "meta",
      externalId,
      formName: champ(plat, "formName"),
      adName: champ(plat, "adName"),
      campaign: champ(plat, "campaign"),
      rawJson: JSON.stringify(plat).slice(0, 5000),
    },
  });

  // Le prospect entre aussi dans « Tous les clients », sans doublon.
  const contact = await creerOuCompleterContact({
    ...(prenom || nom ? { firstName: prenom, lastName: nom } : splitNom(nomComplet)),
    phone,
    email,
    postalCode: lead.postalCode,
    origine: "meta",
  });
  await journaliser(
    contact.id,
    "note",
    [message, lead.adName && `Publicité : ${lead.adName}`, lead.campaign && `Campagne : ${lead.campaign}`]
      .filter(Boolean)
      .join("\n") || "Prospect issu d'une publicité.",
    { sens: "entrant" }
  );
  await notifyOwnerNewLead(lead, settings);

  return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
}
