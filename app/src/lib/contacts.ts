// Base « Tous les clients ». Un contact est créé ou retrouvé à chaque demande
// entrante, quelle qu'en soit l'issue. Le dédoublonnage repose sur le téléphone
// normalisé — l'identifiant le plus fiable dans ce métier, où beaucoup de
// clients n'ont pas d'email ou en donnent un approximatif.
import type { Contact } from "@prisma/client";
import { prisma } from "./prisma";
import { agencePour } from "./agences";

export { ORIGINES, TYPES_INTERACTION } from "./contactLabels";

/**
 * Téléphone réduit à ses chiffres, sans indicatif international, pour comparer
 * « 06 14 31 00 02 », « 0614310002 » et « +33 6 14 31 00 02 ».
 */
export function phoneKeyOf(phone: string): string {
  let d = (phone || "").replace(/\D/g, "");
  if (d.startsWith("0033")) d = d.slice(4);
  else if (d.startsWith("33") && d.length > 10) d = d.slice(2);
  if (d.length === 9) d = `0${d}`; // 614310002 → 0614310002
  return d;
}

export function nomComplet(c: { firstName: string; lastName: string }): string {
  return `${c.firstName} ${c.lastName}`.trim();
}

export type ContactEntrant = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  origine?: string;
};

/** Découpe « Jean Dupont » en prénom / nom (le dernier mot est le nom). */
export function splitNom(complet: string): { firstName: string; lastName: string } {
  const mots = (complet || "").trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return { firstName: "", lastName: "" };
  if (mots.length === 1) return { firstName: "", lastName: mots[0] };
  return { firstName: mots.slice(0, -1).join(" "), lastName: mots[mots.length - 1] };
}

/**
 * Retrouve un contact existant : téléphone normalisé d'abord, email ensuite.
 * Renvoie null si les deux sont vides (on ne rapproche jamais sur le seul nom,
 * trop risqué : deux « Martin » ne sont pas la même personne).
 */
export async function trouverContact(entree: ContactEntrant): Promise<Contact | null> {
  const key = phoneKeyOf(entree.phone ?? "");
  if (key.length >= 9) {
    const parTel = await prisma.contact.findFirst({ where: { phoneKey: key } });
    if (parTel) return parTel;
  }
  const email = (entree.email ?? "").trim().toLowerCase();
  if (email) {
    const parEmail = await prisma.contact.findFirst({ where: { email } });
    if (parEmail) return parEmail;
  }
  return null;
}

/**
 * Crée le contact, ou complète celui qui existe déjà avec les informations
 * nouvelles. On n'écrase jamais une valeur renseignée par une valeur vide.
 */
export async function creerOuCompleterContact(entree: ContactEntrant): Promise<Contact> {
  const existant = await trouverContact(entree);
  const phone = (entree.phone ?? "").trim();
  const email = (entree.email ?? "").trim().toLowerCase();
  const cp = (entree.postalCode ?? "").trim();
  const agence = cp ? await agencePour(cp) : null;

  if (existant) {
    const patch: Record<string, unknown> = {};
    const completer = (champ: keyof Contact, valeur: string) => {
      if (valeur && !String(existant[champ] ?? "").trim()) patch[champ] = valeur;
    };
    completer("firstName", (entree.firstName ?? "").trim());
    completer("lastName", (entree.lastName ?? "").trim());
    completer("email", email);
    completer("address", (entree.address ?? "").trim());
    completer("postalCode", cp);
    completer("city", (entree.city ?? "").trim());
    if (phone && !existant.phone.trim()) {
      patch.phone = phone;
      patch.phoneKey = phoneKeyOf(phone);
    }
    if (!existant.agenceId && agence) patch.agenceId = agence.agence.id;
    if (Object.keys(patch).length === 0) return existant;
    return prisma.contact.update({ where: { id: existant.id }, data: patch });
  }

  return prisma.contact.create({
    data: {
      firstName: (entree.firstName ?? "").trim(),
      lastName: (entree.lastName ?? "").trim(),
      phone,
      phoneKey: phoneKeyOf(phone),
      email,
      address: (entree.address ?? "").trim(),
      postalCode: cp,
      city: (entree.city ?? "").trim(),
      origine: entree.origine ?? "web",
      agenceId: agence?.agence.id ?? null,
    },
  });
}

/** Ajoute une ligne au journal des échanges. Silencieux en cas d'échec. */
export async function journaliser(
  contactId: string,
  type: string,
  contenu: string,
  options?: { sens?: string; auteur?: string }
): Promise<void> {
  try {
    await prisma.interaction.create({
      data: {
        contactId,
        type,
        contenu: contenu.slice(0, 2000),
        sens: options?.sens ?? "interne",
        auteur: options?.auteur ?? "",
      },
    });
  } catch {
    // Le journal ne doit jamais faire échouer une réservation.
  }
}
