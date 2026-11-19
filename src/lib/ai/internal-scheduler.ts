/**
 * Scheduler interne Node : `setInterval` qui déclenche `runSchedulerTick`
 * toutes les 15 min. Simple et suffisant pour un single-process.
 *
 * Note : si l'app tourne en multi-instance (horizontal scale), activer plutôt
 * le cron externe (`AI_SCHEDULER_INTERNAL=0`) + appel `/api/admin/ai/cron-tick`
 * depuis un unique cron job — sinon chaque instance générerait N doublons.
 */
import { logger } from "@/lib/log";

const log = logger("ai-scheduler");
const INTERVAL_MS = 15 * 60 * 1000;

let started = false;

export function startInternalScheduler(): void {
  if (started) return;
  started = true;

  // Décalage initial aléatoire 0-60s pour éviter que plusieurs replicas
  // tapent exactement en même temps si on oublie AI_SCHEDULER_INTERNAL=0.
  const initialDelay = Math.floor(Math.random() * 60_000);

  setTimeout(() => {
    void tickSafely();
    setInterval(() => {
      void tickSafely();
    }, INTERVAL_MS);
  }, initialDelay);

  log.info({ intervalMs: INTERVAL_MS, initialDelay }, "AI internal scheduler started");
}

async function tickSafely(): Promise<void> {
  try {
    const { runSchedulerTick } = await import("./scheduler");
    const result = await runSchedulerTick();
    if (result.skippedReason) {
      log.debug({ result }, "AI tick skipped");
    } else {
      log.info({ result }, "AI tick done");
    }
  } catch (err) {
    log.error({ err }, "AI tick failed");
  }
}
