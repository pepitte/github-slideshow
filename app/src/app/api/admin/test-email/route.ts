import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { emailConfigured, sendEmailChecked, usingTestSender } from "@/lib/email";
import { ownerEmailOf, expediteurOf } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/admin/test-email { to? } — envoie un email d'essai et renvoie un
 * diagnostic lisible : c'est l'outil d'auto-dépannage de la section Alertes.
 * Sans `to`, on teste l'alerte au gérant ; avec `to`, on teste l'envoi à un
 * client (le seul moyen de vérifier qu'un domaine vérifié fonctionne).
 */
export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  let body: { to?: string } = {};
  try {
    body = await req.json();
  } catch {
    // corps vide = test de l'alerte gérant
  }
  const settings = await getSettings();
  const demande = String(body.to ?? "").trim();
  const versClient = demande.length > 0;
  const to = versClient ? demande : ownerEmailOf(settings);

  if (versClient && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ ok: false, message: "Cette adresse email n'est pas valide." });
  }
  if (!to) {
    return NextResponse.json({
      ok: false,
      message:
        "Aucune adresse de destination : renseignez l'email qui doit recevoir les alertes, juste au-dessus, puis enregistrez.",
    });
  }
  if (!emailConfigured()) {
    // Que voit réellement le serveur ? On expose de quoi identifier une faute de
    // frappe ou une valeur vide, sans jamais divulguer la clé elle-même.
    const noms = Object.keys(process.env).filter((k) => /resend/i.test(k));
    const detail = noms.length
      ? noms.map((n) => `« ${n} » (${(process.env[n] ?? "").trim().length} caractères)`).join(", ")
      : "aucune";
    return NextResponse.json({
      ok: false,
      to,
      message:
        "La clé Resend n'est pas encore active sur le site. Variables contenant « resend » vues par le serveur : " +
        detail +
        ". Il faut une variable nommée exactement RESEND_API_KEY, non vide, en environnement Production, puis un nouveau déploiement.",
    });
  }

  const expediteur = expediteurOf(settings);
  const res = await sendEmailChecked({
    to,
    from: expediteur,
    subject: versClient
      ? `Test d'email client — ${settings.companyName}`
      : `Test d'alerte — ${settings.companyName}`,
    text: versClient
      ? [
          "Ceci est un email de test envoyé depuis votre espace gérant.",
          "",
          "Si vous le recevez à cette adresse, les confirmations de rendez-vous",
          "partent bien à vos clients.",
          "",
          settings.companyName,
        ].join("\n")
      : [
          "Ceci est un email de test envoyé depuis vos paramètres.",
          "",
          "Si vous le recevez, vos alertes de nouvelle réservation et de nouveau prospect fonctionnent.",
          "",
          settings.companyName,
        ].join("\n"),
  });

  if (res.ok) {
    // Réussir vers sa propre adresse ne prouve rien : avec l'expéditeur d'essai
    // de Resend, seul le propriétaire du compte reçoit quoi que ce soit.
    const fragile = usingTestSender(expediteur);
    return NextResponse.json({
      ok: true,
      to,
      message:
        `Email de test envoyé à ${to}. Vérifiez la boîte (et les indésirables la première fois).` +
        (fragile
          ? " Attention : aucun expéditeur n'est configuré, l'adresse d'essai de Resend est utilisée — elle n'écrit qu'au propriétaire du compte Resend. Vos clients, eux, ne recevront rien tant qu'un domaine vérifié ne sera pas renseigné ci-dessus."
          : ""),
    });
  }

  // Le motif renvoyé par Resend, traduit quand il est connu.
  const brut = res.error ?? "";
  let message = `L'envoi a été refusé : ${brut}`;
  if (/only send testing emails to your own email/i.test(brut)) {
    message =
      `Resend refuse d'écrire à ${to} : sans domaine vérifié, il n'autorise que l'adresse propriétaire du compte Resend. ` +
      "C'est exactement ce qui empêche vos clients de recevoir leur confirmation. " +
      "Vérifiez votre domaine dans Resend, puis indiquez l'expéditeur ci-dessus (ex. contact@votre-domaine.fr).";
  } else if (/api key is invalid|unauthorized|401/i.test(brut)) {
    message =
      "La clé Resend est refusée (invalide ou révoquée). Recréez-en une dans Resend, puis remplacez RESEND_API_KEY dans Vercel et redéployez.";
  } else if (/domain is not verified|not verified/i.test(brut)) {
    message =
      `Le domaine de l'expéditeur « ${expediteur || "(non renseigné)"} » n'est pas vérifié dans Resend. ` +
      "Terminez la vérification du domaine dans Resend (ajout des enregistrements DNS chez OVH), ou videz le champ expéditeur pour repasser à l'adresse d'essai.";
  } else if (/from.*invalid|invalid.*from/i.test(brut)) {
    message =
      `L'expéditeur « ${expediteur} » n'est pas accepté. Utilisez la forme « Nom <adresse@domaine.fr> » avec un domaine vérifié dans Resend.`;
  }
  return NextResponse.json({ ok: false, to, message });
}
