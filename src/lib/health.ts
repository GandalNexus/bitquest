import { db } from "@/lib/db";
import { getRedis } from "@/lib/cache/redis";

/* ============================================================
 * Health check — Phase 5.1a / 5.1c
 *
 * Expose un état agrégé pour les load balancers et la page admin.
 * - "ok"        : DB répond vite ET Redis OK (ou désactivé proprement)
 * - "degraded" : latence DB élevée OU Redis indisponible (le fallback
 *                in-memory fonctionne mais le rate-limit n'est plus
 *                distribué)
 * - "down"      : DB inaccessible (service non-opérationnel)
 * ============================================================ */

export const HEALTH_DEGRADED_MS = 500;

export type HealthStatus = "ok" | "degraded" | "down";

export type RedisCheck =
  | { status: "ok"; latencyMs: number; error: null }
  | { status: "error"; latencyMs: null; error: string }
  | { status: "skipped"; latencyMs: null; error: null };

export interface HealthReport {
  status: HealthStatus;
  db: { status: "ok" | "error"; latencyMs: number | null; error: string | null };
  redis: RedisCheck;
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

/**
 * Ping Redis non-bloquant. Trois états :
 *   - skipped : REDIS_URL non défini (dev sans Redis) — pas une erreur
 *   - ok      : PING a renvoyé PONG
 *   - error   : commande a jeté
 */
async function pingRedis(): Promise<RedisCheck> {
  const client = await getRedis();
  if (!client) return { status: "skipped", latencyMs: null, error: null };
  const start = Date.now();
  try {
    const res = await client.ping();
    if (res !== "PONG") throw new Error(`unexpected PING reply: ${res}`);
    return { status: "ok", latencyMs: Date.now() - start, error: null };
  } catch (err) {
    return {
      status: "error",
      latencyMs: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getHealthStatus(): Promise<HealthReport> {
  const [ping, redis] = await Promise.all([pingDb(), pingRedis()]);
  const dbOk = ping.error === null;
  const dbSlow = ping.latencyMs !== null && ping.latencyMs > HEALTH_DEGRADED_MS;
  const redisSlow = redis.status === "ok" && redis.latencyMs > HEALTH_DEGRADED_MS;
  const redisDown = redis.status === "error";

  let status: HealthStatus;
  if (!dbOk) status = "down";
  else if (dbSlow || redisDown || redisSlow) status = "degraded";
  else status = "ok";

  return {
    status,
    db: {
      status: dbOk ? "ok" : "error",
      latencyMs: ping.latencyMs,
      error: ping.error,
    },
    redis,
    uptime: Math.floor((Date.now() - STARTED_AT) / 1000),
    env: process.env.NODE_ENV ?? "unknown",
    version: readVersion(),
    now: new Date().toISOString(),
  };
}
