import Redis from "ioredis";
import { logger } from "@/lib/log";

const log = logger("redis");

/* ============================================================
 * Client Redis lazy — Phase 1.4
 *
 * Singleton créé à la première utilisation. Si REDIS_URL n'est pas
 * défini, ou si la connexion échoue, getRedis() retourne null et les
 * callers retombent sur leur comportement in-memory (voir rateLimit
 * dans session.ts).
 *
 * Objectifs :
 *   - zéro friction en dev (pas de Redis = ça marche quand même)
 *   - production multi-instance consistant quand Redis est branché
 * ============================================================ */

let clientPromise: Promise<Redis | null> | null = null;

async function createClient(): Promise<Redis | null> {
  const url = process.env.REDIS_URL;
  if (!url || url.trim().length === 0) return null;

  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1, // une seule retry par commande : on préfère retomber en in-memory vite
    enableOfflineQueue: false,
    connectTimeout: 1500,
    // Silence les erreurs répétées d'auto-reconnexion : on logge une seule fois ci-dessous.
    retryStrategy: () => null,
  });

  // Première erreur logguée, suivantes ignorées (évite le bruit en dev).
  let errorLogged = false;
  client.on("error", (err) => {
    if (!errorLogged) {
      errorLogged = true;
      log.warn({ err: err.message }, "redis unavailable — falling back to in-memory");
    }
  });

  try {
    await client.connect();
    log.info({ url: url.replace(/:[^:/]+@/, ":***@") }, "redis connected");
    return client;
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "redis connect failed — falling back to in-memory",
    );
    // Détache les listeners et termine proprement.
    client.disconnect();
    return null;
  }
}

/** Retourne le client Redis prêt-à-l'emploi, ou null si indisponible. */
export async function getRedis(): Promise<Redis | null> {
  if (clientPromise === null) {
    clientPromise = createClient();
  }
  return clientPromise;
}

/** Permet de réinitialiser le singleton (utile dans les tests). */
export function __resetRedisClientForTests(): void {
  clientPromise = null;
}
