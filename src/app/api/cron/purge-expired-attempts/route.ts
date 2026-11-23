import { expireStaleAttempts } from "@/lib/bitlab/attempt";
import { logger } from "@/lib/log";
import { captureBusinessWarning } from "@/lib/obs/sentry";
import crypto from "crypto";

const log = logger("cron-purge-attempts");

/** Seuil au-delà duquel une purge est anormale (incident à investiguer). */
const PURGE_ANOMALY_THRESHOLD = 100;

/**
 * POST /api/cron/purge-expired-attempts
 *
 * Batch de maintenance : marque `EXPIRED` tous les `MissionAttempt`
 * actifs dont `expiresAt < now`. Idempotent (updateMany conditionnel).
 * À appeler par un cron externe (cf. `docs/POSTGRES_PROD.md`).
 *
 * Auth :
 *   - Header `X-Cron-Secret` qui matche la var env `CRON_SECRET`
 *     (comparaison en temps constant).
 *   - En l'absence de `CRON_SECRET` (dev), la route refuse 503 pour
 *     éviter d'ouvrir un endpoint non protégé.
 *
 * Réponse :
 *   { ok: true, expired: <count>, elapsedMs: <int> }
 */
export async function POST(req: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected || expected.length < 16) {
    log.warn({ msg: "CRON_SECRET absent ou trop court — route refusée" });
    return Response.json(
      { error: "Cron désactivé : CRON_SECRET non configuré." },
      { status: 503 },
    );
  }
  const provided = req.headers.get("x-cron-secret") ?? "";
  // timing-safe : égalise les longueurs via pad / rejette si différent.
  const a = Buffer.from(expected);
  const b = Buffer.from(provided.padEnd(expected.length, "\0").slice(0, expected.length));
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok || provided.length !== expected.length) {
    log.warn({ msg: "cron secret mismatch" });
    return Response.json({ error: "Secret invalide." }, { status: 401 });
  }

  const start = Date.now();
  const expired = await expireStaleAttempts();
  const elapsedMs = Date.now() - start;
  log.info({ expired, elapsedMs }, "mission attempts purge batch");
  if (expired > PURGE_ANOMALY_THRESHOLD) {
    // LOT 31 : surveillance ops — à ce volume, probablement un incident
    // (BitLab down ? grosse vague utilisateurs abandonnant leur quête ?).
    captureBusinessWarning(
      "mission attempts purge above threshold",
      { scope: "cron-purge-attempts", outcome: "ANOMALY" },
      { expired, elapsedMs, threshold: PURGE_ANOMALY_THRESHOLD },
    );
  }
  return Response.json({ ok: true, expired, elapsedMs });
}

// GET interdit (idempotence batch = POST only, évite les crawlers)
export function GET() {
  return Response.json({ error: "POST uniquement." }, { status: 405 });
}
