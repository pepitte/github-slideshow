// Libellés partagés entre le serveur et les écrans. Module volontairement pur
// (aucun accès base de données) : il est importé par des composants navigateur.

export const ORIGINES: Record<string, string> = {
  web: "Réservation en ligne",
  manual: "Saisi par le gérant",
  meta: "Publicité Facebook/Instagram",
  phone: "Appel téléphonique",
  recommandation: "Recommandation",
  site: "Formulaire du site",
};

export const TYPES_INTERACTION: Record<string, string> = {
  appel: "Appel",
  email: "Email",
  sms: "SMS",
  note: "Note",
  rdv: "Rendez-vous",
  devis: "Devis",
};
