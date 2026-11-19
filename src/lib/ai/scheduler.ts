/**
 * Scheduler IA — exécute un tick qui génère les brouillons dûs selon
 * `AIGenerationConfig`. Utilise un brief minimal basé sur le hint persisté.
 */
import { db } from "@/lib/db";
import { isAIGenerationLive } from "./anthropic-client";
import { loadTaxonomy } from "./context";
import { generateDraft } from "./generate";
import { checkConformity } from "./validate";
import { GenerationBriefSchema, isDraftType, type DraftType } from "./schemas";

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

    // Brief automatique : utilise le hint config comme sujet, mode NEW,
    // audience BEGINNER par défaut. L'admin peut raffiner dans AIGenerationConfig.
    const briefParse = GenerationBriefSchema.safeParse({
      type,
      mode: "NEW",
      subject: cfg.hint ?? `Génération automatique ${type}`,
      audience: "BEGINNER",
      concepts: [],
    });
    if (!briefParse.success) {
      runs.push({
        type,
        generated: 0,
        error: `Brief auto invalide : ${briefParse.error.issues[0]?.message ?? "unknown"}`,
      });
      await db.aIGenerationConfig.update({
        where: { type },
        data: { lastRunAt: new Date(now), lastError: "brief auto invalide" },
      });
      continue;
    }
    const brief = briefParse.data;

    try {
      const taxonomy = await loadTaxonomy(type);
      for (let i = 0; i < Math.max(1, Math.min(cfg.maxPerRun, 5)); i++) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await generateDraft({ type, brief, taxonomy: taxonomy as any });
          const issues = checkConformity(type, result.draft);
          const errors = issues.filter((i) => i.severity === "error");
          if (errors.length > 0) {
            lastError = `Conformity errors: ${errors.map((e) => e.code).join(", ")}`;
            break;
          }
          const warnings = issues.filter((i) => i.severity === "warning");
          await db.aIDraft.create({
            data: {
              type,
              payload: JSON.stringify(result.draft),
              aiModel: result.model,
              tokensInput:
                result.usage.input + result.usage.cacheRead + result.usage.cacheCreated,
              tokensOutput: result.usage.output,
              rejectReason:
                warnings.length > 0
                  ? warnings.map((w) => `⚠ ${w.message}`).join(" | ")
                  : null,
            },
          });
          generated++;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
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
