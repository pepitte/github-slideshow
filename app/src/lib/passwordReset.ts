// Réinitialisation de mot de passe (particuliers et professionnels) :
// lien envoyé par email, valable 1 heure, à usage unique.
import { randomBytes } from "crypto";
import { prisma } from "./prisma";
import { sendEmail } from "./email";
import { hashPassword } from "./proAuth";
import { appUrl } from "./templates";

export type AccountKind = "client" | "pro";

/* eslint-disable @typescript-eslint/no-explicit-any */
function table(kind: AccountKind): any {
  return kind === "client" ? prisma.client : prisma.pro;
}

/** Envoie le lien si le compte existe. Ne révèle jamais si l'email est connu. */
export async function requestPasswordReset(kind: AccountKind, email: string): Promise<void> {
  const account = await table(kind).findUnique({ where: { email } });
  if (!account) return;
  const token = randomBytes(32).toString("hex");
  await table(kind).update({
    where: { email },
    data: { resetToken: token, resetExpiry: new Date(Date.now() + 3600_000) },
  });
  const path = kind === "client" ? "/compte/reinitialiser" : "/pro/reinitialiser";
  await sendEmail({
    to: email,
    subject: "Réinitialisation de votre mot de passe — Arboris Paysage",
    text:
      `Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n` +
      `${appUrl()}${path}?token=${token}\n\n` +
      `Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.\n\n` +
      `Arboris Paysage`,
  });
}

/** Applique le nouveau mot de passe si le jeton est valide. */
export async function confirmPasswordReset(
  kind: AccountKind,
  token: string,
  password: string
): Promise<boolean> {
  if (!token || password.length < 6) return false;
  const account = await table(kind).findFirst({
    where: { resetToken: token, resetExpiry: { gt: new Date() } },
  });
  if (!account) return false;
  await table(kind).update({
    where: { id: account.id },
    data: { passwordHash: hashPassword(password), resetToken: "", resetExpiry: null },
  });
  return true;
}
