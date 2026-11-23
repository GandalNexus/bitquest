import crypto from "crypto";
import { parseCookieHeader } from "@/lib/bitquest/session";

/* ============================================================
 * CSRF — double-submit cookie HMAC-based (stateless).
 *
 * - Le client lit le cookie `bq_csrf` (readable, SameSite=Lax) et
 *   envoie sa valeur dans le header `X-CSRF-Token` sur toutes les
 *   mutations.
 * - Le serveur recalcule `HMAC(secret, user.token)` et compare en
 *   temps constant. Pas besoin de stocker le token : il est dérivé
 *   déterministiquement du token de session (qui est rotés à chaque
 *   login/logout).
 * ============================================================ */

export const CSRF_COOKIE = "bq_csrf";
export const CSRF_HEADER = "x-csrf-token";

const DEV_SECRET = "bitquest-dev-insecure-csrf-secret";

/** Clé HMAC. En production, exige CSRF_SECRET en env ; en dev, fallback fixe. */
export function getCsrfSecret(): string {
  const secret = process.env.CSRF_SECRET;
  if (secret && secret.length > 0) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("CSRF_SECRET is required in production.");
  }
  return DEV_SECRET;
}

/** Dérive un token CSRF à partir du session token (déterministe, stateless). */
export function computeCsrfToken(sessionToken: string): string {
  return crypto.createHmac("sha256", getCsrfSecret()).update(sessionToken).digest("hex");
}

/** Comparaison en temps constant (évite les timing attacks). */
export function verifyCsrfToken(sessionToken: string, provided: string | null | undefined): boolean {
  if (!provided) return false;
  const expected = computeCsrfToken(sessionToken);
  if (provided.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

/** Set-Cookie pour le token CSRF — readable côté JS, mais protégé par SameSite=Lax. */
export function buildCsrfCookie(token: string, opts: { maxAgeSeconds?: number; secure?: boolean } = {}): string {
  const parts = [
    `${CSRF_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "SameSite=Lax",
  ];
  if (opts.maxAgeSeconds !== undefined) parts.push(`Max-Age=${opts.maxAgeSeconds}`);
  if (opts.secure ?? process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

/** Supprime le cookie CSRF. */
export function buildClearCsrfCookie(opts: { secure?: boolean } = {}): string {
  const parts = [`${CSRF_COOKIE}=`, "Path=/", "SameSite=Lax", "Max-Age=0"];
  if (opts.secure ?? process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

/**
 * Vérifie le CSRF sur une mutation. À appeler uniquement quand la requête
 * est authentifiée via cookie (les headers legacy x-gn-* sont immunes).
 */
export function requireCsrf(req: Request, sessionToken: string): { ok: true } | { ok: false; response: Response } {
  const provided = req.headers.get(CSRF_HEADER);
  if (!verifyCsrfToken(sessionToken, provided)) {
    return {
      ok: false,
      response: Response.json({ error: "Jeton CSRF manquant ou invalide." }, { status: 403 }),
    };
  }
  return { ok: true };
}

/** Détecte si la requête est authentifiée via cookie (pour activer CSRF). */
export function isCookieAuthenticated(req: Request): boolean {
  const cookies = parseCookieHeader(req.headers.get("cookie"));
  return Boolean(cookies.bq_session);
}
