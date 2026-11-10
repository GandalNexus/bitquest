import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/bitquest/session";
import { hasAtLeastRole, type Role } from "./roles";
import type { User } from "@prisma/client";

/* ============================================================
 * Helpers auth côté Server Components / Route Handlers SSR.
 *
 * Pendant les Server Components, on ne reçoit pas de Request brute :
 * on utilise `cookies()` de next/headers pour lire la session.
 * ============================================================ */

/** Charge l'utilisateur courant depuis le cookie `bq_session`. null si absent / invalide. */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return db.user.findUnique({ where: { token } });
}

/**
 * Vérifie que l'utilisateur courant a au moins le rôle requis.
 * - `ok:true, user` si autorisé.
 * - `ok:false, reason:"unauthenticated"` si pas de session.
 * - `ok:false, reason:"forbidden"` si session mais rôle insuffisant.
 */
export async function requireRoleSsr(
  required: Role,
): Promise<
  | { ok: true; user: User }
  | { ok: false; reason: "unauthenticated" | "forbidden"; user: User | null }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "unauthenticated", user: null };
  if (!hasAtLeastRole(user.role, required)) {
    return { ok: false, reason: "forbidden", user };
  }
  return { ok: true, user };
}
