import { db } from "@/lib/db";

/** Authentifie une requête via les en-têtes x-gn-user-id / x-gn-token. Retourne l'utilisateur ou null. */
export async function authenticate(req: Request) {
  const userId = req.headers.get("x-gn-user-id");
  const token = req.headers.get("x-gn-token");
  if (!userId || !token) return null;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.token !== token) return null;
  return user;
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
