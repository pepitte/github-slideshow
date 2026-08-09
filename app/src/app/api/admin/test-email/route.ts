import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { emailConfigured, sendEmailChecked } from "@/lib/email";
import { ownerEmailOf } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST /api/admin/test-email — envoie une alerte d'essai au gérant et renvoie
// un diagnostic lisible : c'est l'outil d'auto-dépannage de la section Alertes.
export async function POST() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const settings = await getSettings();
  const to = ownerEmailOf(settings);

  if (!to) {
    return NextResponse.json({
      ok: false,
      message:
        "Aucune adresse de destination : renseignez l'email qui doit recevoir les alertes, juste au-dessus, puis enregistrez.",
    });
  }
  if (!emailConfigured()) {
    return NextResponse.json({
      ok: false,
      to,
      message:
        "La clé Resend n'est pas encore active sur le site. Vérifiez la variable RESEND_API_KEY dans Vercel (projet arboris-paysage, environnement Production), puis relancez un déploiement.",
    });
  }

  const res = await sendEmailChecked({
    to,
    subject: `Test d'alerte — ${settings.companyName}`,
    text: [
      "Ceci est un email de test envoyé depuis vos paramètres.",
      "",
      "Si vous le recevez, vos alertes de nouvelle réservation et de nouveau prospect fonctionnent.",
      "",
      settings.companyName,
    ].join("\n"),
  });

  if (res.ok) {
    return NextResponse.json({
      ok: true,
      to,
      message: `Email de test envoyé à ${to}. Vérifiez votre boîte (et les indésirables la première fois).`,
    });
  }

  // Le motif renvoyé par Resend, traduit quand il est connu.
  const brut = res.error ?? "";
  let message = `L'envoi a été refusé : ${brut}`;
  if (/only send testing emails to your own email/i.test(brut)) {
    message = `Resend refuse d'écrire à ${to} : sans nom de domaine vérifié, il n'autorise que l'adresse propriétaire du compte Resend. Mettez cette adresse-là, ou vérifiez un domaine dans Resend.`;
  } else if (/api key is invalid|unauthorized|401/i.test(brut)) {
    message =
      "La clé Resend est refusée (invalide ou révoquée). Recréez-en une dans Resend, puis remplacez RESEND_API_KEY dans Vercel et redéployez.";
  } else if (/domain is not verified/i.test(brut)) {
    message =
      "Le domaine d'expédition n'est pas vérifié dans Resend. Retirez la variable EMAIL_FROM de Vercel pour utiliser l'adresse d'essai de Resend, ou vérifiez votre domaine.";
  }
  return NextResponse.json({ ok: false, to, message });
}
