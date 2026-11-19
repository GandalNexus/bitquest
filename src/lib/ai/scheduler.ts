/**
 * Scheduler IA — exécute un "tick" qui :
 *   1. Lit `AIGenerationConfig` pour chaque type.
 *   2. Pour chaque config `enabled` dont la cadence est écoulée, génère
 *      `maxPerRun` brouillons.
 *   3. Met à jour `lastRunAt` (et `lastError` si échec).
 *
 * Idempotent : si le kill-switch env est off, retourne immédiatement.
 * Non-bloquant : erreurs par-type logguées mais ne cassent pas la boucle.
 */
import { db } from "@/lib/db";
import { isAIGenerationLive } from "./anthropic-client";
import { loadGenerationContext } from "./context";
import { generateDraft } from "./generate";
import { isDraftType, type DraftType } from "./schemas";

export interface TickResult {
  skippedReason?: "kill_switch" | "no_configs";
  runs: Array<{
    type: DraftType;
    generated: number;
    skipped?: "not_due" | "disabled";
    error?: string;
  }>;
}

export async function runSchedulerTick(): Promise<TickResult> {
  if (!isAIGenerationLive()) {
    return { skippedReason: "kill_switch", runs: [] };
  }

  const configs = await db.aIGenerationConfig.findMany();
  if (configs.length === 0) {
    return { skippedReason: "no_configs", runs: [] };
  }

  const now = Date.now();
  const runs: TickResult["runs"] = [];

  for (const cfg of configs) {
    if (!isDraftType(cfg.type)) continue;
    const type = cfg.type as DraftType;

    if (!cfg.enabled) {
      runs.push({ type, generated: 0, skipped: "disabled" });
      continue;
    }
    const dueAt =
      cfg.lastRunAt === null
        ? 0
        : cfg.lastRunAt.getTime() + cfg.cadenceHours * 3600_000;
    if (now < dueAt) {
      runs.push({ type, generated: 0, skipped: "not_due" });
      continue;
    }

    let generated = 0;
    let lastError: string | null = null;
    try {
      const ctx = await loadGenerationContext(type);
      for (let i = 0; i < Math.max(1, Math.min(cfg.maxPerRun, 5)); i++) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await generateDraft({ type, context: ctx as any, hint: cfg.hint ?? undefined });
          await db.aIDraft.create({
            data: {
              type,
              payload: JSON.stringify(result.draft),
              aiModel: result.model,
              tokensInput:
                result.usage.input + result.usage.cacheRead + result.usage.cacheCreated,
              tokensOutput: result.usage.output,
            },
          });
          generated++;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          // On ne propage pas : garde ce qui a été généré avant l'erreur.
          break;
        }
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    await db.aIGenerationConfig.update({
      where: { type },
      data: {
        lastRunAt: new Date(now),
        lastError,
      },
    });
    runs.push({ type, generated, error: lastError ?? undefined });
  }

  return { runs };
}
