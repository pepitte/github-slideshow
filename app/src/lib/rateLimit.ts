// Limitation des tentatives de connexion : 3 échecs → blocage 15 minutes.
// Compteur en mémoire du serveur (suffisant ici : un seul serveur, une entreprise).

const MAX_ATTEMPTS = 3;
const BLOCK_MS = 15 * 60_000;

type Entry = { fails: number; blockedUntil: number };
const attempts = new Map<string, Entry>();

/** Identifie l'appelant : IP transmise par l'hébergeur, sinon "inconnu". */
export function callerKey(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "inconnu"
  );
}

/** Minutes restantes de blocage, 0 si l'appelant peut essayer. */
export function blockedFor(key: string): number {
  const e = attempts.get(key);
  if (!e || e.blockedUntil <= Date.now()) return 0;
  return Math.ceil((e.blockedUntil - Date.now()) / 60_000);
}

/** Échec : incrémente et bloque au 3e essai. */
export function registerFailure(key: string): void {
  const e = attempts.get(key) ?? { fails: 0, blockedUntil: 0 };
  e.fails += 1;
  if (e.fails >= MAX_ATTEMPTS) {
    e.blockedUntil = Date.now() + BLOCK_MS;
    e.fails = 0; // le compteur repart après le blocage
  }
  attempts.set(key, e);
}

/** Succès : remet le compteur à zéro. */
export function registerSuccess(key: string): void {
  attempts.delete(key);
}
