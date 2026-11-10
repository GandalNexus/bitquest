import type { User } from "@prisma/client";
import { isCookieAuthenticated, requireCsrf } from "./csrf";
import { requireRole, type Role } from "./roles";

/**
 * Pattern commun aux routes API mutantes qui exigent un rôle :
 *   const guard = await requireRoleAndCsrf(req, "ADMIN");
 *   if (!guard.ok) return guard.response;
 *   const user = guard.user;
 *
 * - Vérifie le rôle (401 ou 403).
 * - Si l'auth passe par cookie, exige également un X-CSRF-Token valide.
 * - Les requêtes via headers legacy x-gn-* sont immunes au CSRF.
 */
export async function requireRoleAndCsrf(
  req: Request,
  role: Role,
): Promise<{ ok: true; user: User } | { ok: false; response: Response }> {
  const auth = await requireRole(req, role);
  if (!auth.ok) return auth;
  if (isCookieAuthenticated(req)) {
    const csrf = requireCsrf(req, auth.user.token);
    if (!csrf.ok) return csrf;
  }
  return auth;
}
