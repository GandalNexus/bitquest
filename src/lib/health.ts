import { db } from "@/lib/db";

/* ============================================================
 * Health check — Phase 5.1a
 *
 * Expose un état agrégé pour les load balancers et la page admin.
 * - "ok"        : tout fonctionne
 * - "degraded" : DB répond mais latence élevée
 * - "down"      : DB inaccessible
 *
 * Volontairement minimal : pas de dépendance externe, pas de logs
 * structurés — ceux-ci arrivent dans une étape suivante.
 * ============================================================ */

export const HEALTH_DEGRADED_MS = 500;

export type HealthStatus = "ok" | "degraded" | "down";

export interface HealthReport {
  status: HealthStatus;
  db: { status: "ok" | "error"; latencyMs: number | null; error: string | null };
  uptime: number; // en secondes depuis le démarrage du process
  env: string;
  version: string;
  now: string;
}

function readVersion(): string {
  return process.env.npm_package_version ?? "0.0.0";
}

/** Date de démarrage du process (fige à la première évaluation du module). */
const STARTED_AT = Date.now();

/** Ping DB non-destructif. Compatible SQLite et Postgres. */
async function pingDb(): Promise<{ latencyMs: number; error: null } | { latencyMs: null; error: string }> {
  const start = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return { latencyMs: Date.now() - start, error: null };
  } catch (err) {
    return {
      latencyMs: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getHealthStatus(): Promise<HealthReport> {
  const ping = await pingDb();
  const dbOk = ping.error === null;
  let status: HealthStatus;
  if (!dbOk) status = "down";
  else if (ping.latencyMs !== null && ping.latencyMs > HEALTH_DEGRADED_MS) status = "degraded";
  else status = "ok";

  return {
    status,
    db: {
      status: dbOk ? "ok" : "error",
      latencyMs: ping.latencyMs,
      error: ping.error,
    },
    uptime: Math.floor((Date.now() - STARTED_AT) / 1000),
    env: process.env.NODE_ENV ?? "unknown",
    version: readVersion(),
    now: new Date().toISOString(),
  };
}
