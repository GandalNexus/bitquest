import { authenticate, unauthorized } from "@/lib/bitquest/session";
import type { User } from "@prisma/client";

/* ============================================================
 * Rôles utilisateur BitQuest.
 *
 * Hiérarchie : APPRENTICE < EDITOR < ADMIN.
 * Un utilisateur avec un rôle N a implicitement tous les droits
 * des rôles < N (hasAtLeastRole).
 *
 * Stockés en String dans Prisma (SQLite compat) avec une valeur
 * par défaut APPRENTICE au niveau du schéma.
 * ============================================================ */

export const ROLES = ["APPRENTICE", "EDITOR", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

const ROLE_RANK: Record<Role, number> = {
  APPRENTICE: 0,
  EDITOR: 1,
  ADMIN: 2,
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Normalise une valeur potentiellement inconnue vers un rôle (APPRENTICE par défaut). */
export function normalizeRole(value: unknown): Role {
  return isRole(value) ? value : "APPRENTICE";
}

/** Vrai si `actual` est au moins aussi élevé que `required` dans la hiérarchie. */
export function hasAtLeastRole(actual: Role | string | null | undefined, required: Role): boolean {
  const a = isRole(actual) ? actual : "APPRENTICE";
  return ROLE_RANK[a] >= ROLE_RANK[required];
}

/* ============ Helpers côté route ============ */

/** 403 Forbidden : rôle insuffisant pour l'action. */
export function forbidden(message = "Accès refusé : rôle insuffisant."): Response {
  return Response.json({ error: message }, { status: 403 });
}

/**
 * Charge l'utilisateur authentifié et vérifie son rôle.
 * - Pas de session → `{ ok:false, response: 401 }`.
 * - Rôle insuffisant → `{ ok:false, response: 403 }`.
 * - OK → `{ ok:true, user }`.
 */
export async function requireRole(
  req: Request,
  required: Role,
): Promise<{ ok: true; user: User } | { ok: false; response: Response }> {
  const user = await authenticate(req);
  if (!user) return { ok: false, response: unauthorized() };
  if (!hasAtLeastRole(user.role, required)) {
    return { ok: false, response: forbidden() };
  }
  return { ok: true, user };
}
