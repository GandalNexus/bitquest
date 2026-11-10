import { db } from "@/lib/db";

/* ============================================================
 * Session BitQuest.
 *
 * Deux modes d'authentification sont acceptés simultanément
 * (migration douce, Phase 1.2a) :
 *   1. Cookie HttpOnly `bq_session=<token>` — préféré.
 *   2. En-têtes legacy `x-gn-user-id` + `x-gn-token` — back-compat.
 *
 * Le `token` est la valeur unique stockée sur User.token et rotée à
 * chaque login/logout.
 * ============================================================ */

export const SESSION_COOKIE = "bq_session";

/** Parse un header Cookie: `a=b; c=d` → `{ a: "b", c: "d" }`. */
export function parseCookieHeader(header: string | null | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

/** Construit la valeur de Set-Cookie pour le cookie de session. */
export function buildSessionCookie(
  token: string,
  opts: { maxAgeSeconds?: number; secure?: boolean } = {},
): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
  ];
  if (opts.maxAgeSeconds !== undefined) parts.push(`Max-Age=${opts.maxAgeSeconds}`);
  if (opts.secure ?? process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

/** Construit la valeur de Set-Cookie qui supprime le cookie de session. */
export function buildClearSessionCookie(opts: { secure?: boolean } = {}): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (opts.secure ?? process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

/**
 * Authentifie une requête, en préférant le cookie HttpOnly.
 *
 * - Cookie `bq_session=<token>` → résout l'utilisateur par `User.token` unique.
 * - Fallback : en-têtes legacy `x-gn-user-id` + `x-gn-token`.
 *
 * Retourne l'utilisateur ou `null`.
 */
export async function authenticate(req: Request) {
  const cookies = parseCookieHeader(req.headers.get("cookie"));
  const cookieToken = cookies[SESSION_COOKIE];
  if (cookieToken) {
    const user = await db.user.findUnique({ where: { token: cookieToken } });
    if (user) return user;
  }

  const userId = req.headers.get("x-gn-user-id");
  const headerToken = req.headers.get("x-gn-token");
  if (userId && headerToken) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (user && user.token === headerToken) return user;
  }

  return null;
}

export function unauthorized() {
  return Response.json({ error: "Session invalide ou expirée." }, { status: 401 });
}

/* ============ Rate limiting simple en mémoire ============ */

const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);
  return true;
}
