import crypto from "node:crypto";

/* ============================================================
 * Password hashing BitQuest — source unique de vérité.
 *
 * Centralise `hashPassword` / `verifyPassword` pour les 3 routes qui
 * dupliquaient (et divergeaient sur les gardes) : /api/auth,
 * /api/me/password, /api/me/delete.
 *
 * Mécanisme — INCHANGÉ pour compat 100% avec les hashs en DB :
 *   - Scrypt (Node crypto.scryptSync).
 *   - Salt aléatoire 16 octets → 32 chars hex.
 *   - Hash 32 octets → 64 chars hex.
 *   - Stockage format "salt:hash" (deux hex séparés par ':').
 *
 * Gardes strictes avant timingSafeEqual (le point faible historique) :
 *   - Guard stored string non-vide.
 *   - Exactement un ':' séparateur.
 *   - Salt exactement 32 chars + hex uniquement.
 *   - Hash exactement 64 chars + hex uniquement.
 *   - Longueur buffers égale avant timingSafeEqual (défense en profondeur
 *     même après les regex — timingSafeEqual *jette* une RangeError si
 *     les buffers diffèrent en taille, ce qui ferait crasher la route).
 *
 * Toutes les branches de refus sont en temps constant côté couche
 * dépendante du secret (la partie scrypt), ce qui suffit en pratique :
 * un attaquant ne peut pas distinguer un échec "format" d'un échec
 * "hash mismatch" via timing du handler HTTP (rate-limit dessus).
 * ============================================================ */

/** Taille du salt en octets (= 32 chars hex). */
export const SALT_BYTES = 16;

/** Taille du hash scrypt en octets (= 64 chars hex). */
export const HASH_BYTES = 32;

const SALT_HEX_LENGTH = SALT_BYTES * 2;
const HASH_HEX_LENGTH = HASH_BYTES * 2;
const HEX_RE = /^[0-9a-f]+$/i;

/**
 * Produit un hash scrypt stocké au format `salt:hash` (hex:hex).
 * Non-déterministe — chaque appel génère un salt frais.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_BYTES).toString("hex");
  const hash = crypto.scryptSync(password, salt, HASH_BYTES).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Vérifie qu'un `password` matche un `stored` au format `salt:hash`.
 *
 * Retourne false (jamais throw) pour tout input invalide : stored null,
 * format malformé, parts non-hex, longueurs incorrectes. Timing côté
 * couche crypto reste constant pour les stored bien formés.
 */
export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (typeof stored !== "string" || stored.length === 0) return false;

  // Séparateur strict : exactement UN ':' dans la string.
  // `indexOf` + `lastIndexOf` évite d'autoriser "salt:hash:extra".
  const firstColon = stored.indexOf(":");
  if (firstColon === -1) return false;
  if (firstColon !== stored.lastIndexOf(":")) return false;

  const salt = stored.slice(0, firstColon);
  const hash = stored.slice(firstColon + 1);
  if (salt.length === 0 || hash.length === 0) return false;

  // Longueur + charset hex strict pour les deux moitiés. Buffer.from(_, 'hex')
  // ignore silencieusement les bytes invalides — on refuse avant.
  if (salt.length !== SALT_HEX_LENGTH || !HEX_RE.test(salt)) return false;
  if (hash.length !== HASH_HEX_LENGTH || !HEX_RE.test(hash)) return false;

  let hashBuf: Buffer;
  let checkBuf: Buffer;
  try {
    hashBuf = Buffer.from(hash, "hex");
    // scryptSync peut throw sur un password string invalide (rare : chars
    // de contrôle acceptés, UTF-8 OK) → on wrap défensivement.
    checkBuf = crypto.scryptSync(password, salt, HASH_BYTES);
  } catch {
    return false;
  }

  // Défense en profondeur : les regex garantissent déjà cette égalité,
  // mais on la re-check avant timingSafeEqual qui jette une RangeError
  // (bug historique : auth/route.ts sans ce check ⇒ crash si hash tronqué).
  if (hashBuf.length !== checkBuf.length) return false;

  return crypto.timingSafeEqual(hashBuf, checkBuf);
}
