import { db } from "@/lib/db";
import { logger } from "@/lib/log";

const log = logger("feature-flag");

/* ============================================================
 * Feature flags dynamiques (P3).
 *
 * Deux modes :
 *   - Global : `enabled = true` → flag actif pour tous.
 *   - Per-user : `userIds` (JSON array) override — flag "on" pour
 *     ces userIds même si enabled=false. Pattern release canary.
 *
 * Tolérance aux pannes : si la table n'existe pas (migration non
 * appliquée) ou si la requête échoue, `isFeatureEnabled` retourne
 * `defaultValue` (false par défaut) et log un warn. Un flag absent
 * n'est jamais bloquant pour le code appelant.
 *
 * Cache : pas de cache in-memory pour l'instant — Prisma interroge
 * directement. À ajouter (TTL 30s) si volumétrie de lectures
 * problématique.
 * ============================================================ */

export interface FeatureFlagRow {
  key: string;
  description: string;
  enabled: boolean;
  userIds: string[];
}

/** Parse le champ JSON `userIds` défensivement : toujours une liste. */
function parseUserIds(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    // silent
  }
  return [];
}

/**
 * Évalue un flag pour un utilisateur donné.
 *
 * @param key Clé du flag (ex: "academy.v2").
 * @param userId Id de l'utilisateur, ou `null` pour évaluation globale.
 * @param defaultValue Valeur de repli si le flag n'existe pas en base.
 * @returns `true` si le flag est actif pour ce user.
 */
export async function isFeatureEnabled(
  key: string,
  userId: string | null,
  defaultValue = false,
): Promise<boolean> {
  try {
    const row = await db.featureFlag.findUnique({ where: { key } });
    if (!row) return defaultValue;
    const perUser = parseUserIds(row.userIds);
    if (userId && perUser.includes(userId)) return true;
    return row.enabled;
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err), key },
      "isFeatureEnabled : lecture impossible, fallback defaultValue",
    );
    return defaultValue;
  }
}
