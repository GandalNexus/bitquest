/**
 * Validation de conformité post-génération — vérifie que le brouillon
 * respecte les règles métier BitQuest au-delà de la seule validité Zod.
 *
 * Retourne une liste de warnings/erreurs. Les erreurs bloquent l'enregistrement
 * du draft ; les warnings sont persistés dans `AIDraft.rejectReason` (avec
 * status PENDING) pour que l'admin review les voit à la review.
 */
import type { DraftType } from "./schemas";
import type { DraftPayload } from "./generate";

export interface ConformityIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
}

const XP_RANGES: Record<string, { xpMin: number; xpMax: number; satsMin: number; satsMax: number }> = {
  INITIATION: { xpMin: 20, xpMax: 80, satsMin: 10, satsMax: 50 },
  INTERMEDIATE: { xpMin: 80, xpMax: 200, satsMin: 50, satsMax: 150 },
  ADVANCED: { xpMin: 200, xpMax: 400, satsMin: 150, satsMax: 500 },
  SPECIAL: { xpMin: 100, xpMax: 500, satsMin: 0, satsMax: 2000 },
};

export function checkConformity<T extends DraftType>(
  type: T,
  payload: DraftPayload<T>,
): ConformityIssue[] {
  const issues: ConformityIssue[] = [];

  switch (type) {
    case "QUEST": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = payload as any;
      const range = XP_RANGES[q.track];
      if (range) {
        if (q.xpReward < range.xpMin || q.xpReward > range.xpMax) {
          issues.push({
            severity: "warning",
            code: "QUEST_XP_OUT_OF_RANGE",
            message: `XP ${q.xpReward} hors range ${q.track} [${range.xpMin}-${range.xpMax}]`,
          });
        }
        if (q.satsReward < range.satsMin || q.satsReward > range.satsMax) {
          issues.push({
            severity: "warning",
            code: "QUEST_SATS_OUT_OF_RANGE",
            message: `Sats ${q.satsReward} hors range ${q.track} [${range.satsMin}-${range.satsMax}]`,
          });
        }
      }
      if (q.scenario && q.intro && q.scenario.trim() === q.intro.trim()) {
        issues.push({
          severity: "warning",
          code: "QUEST_SCENARIO_EQ_INTRO",
          message: "`scenario` et `intro` sont identiques — devraient différer.",
        });
      }
      break;
    }
    case "LESSON": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const l = payload as any;
      const totalChars =
        (l.intro?.length ?? 0) +
        (l.sections?.reduce((acc: number, s: { body: string }) => acc + s.body.length, 0) ?? 0) +
        (l.conclusion?.length ?? 0);
      const estimatedChars = l.estimatedMinutes * 1000; // ~200 wpm × 5 char/word
      if (l.estimatedMinutes >= 5 && totalChars < estimatedChars / 3) {
        issues.push({
          severity: "warning",
          code: "LESSON_TOO_SHORT_FOR_TIME",
          message: `${l.estimatedMinutes} min annoncées pour seulement ${totalChars} caractères — ajuster.`,
        });
      }
      break;
    }
    case "CHAPTER": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = payload as any;
      if (c.lessonsPlan.length < 2) {
        issues.push({
          severity: "warning",
          code: "CHAPTER_PLAN_TOO_SHORT",
          message: `Plan de seulement ${c.lessonsPlan.length} leçon(s) — minimum recommandé = 2.`,
        });
      }
      break;
    }
    case "CHALLENGE": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ch = payload as any;
      const today = new Date().toISOString().slice(0, 10);
      if (ch.date < today) {
        issues.push({
          severity: "error",
          code: "CHALLENGE_DATE_PAST",
          message: `Date ${ch.date} dans le passé.`,
        });
      }
      break;
    }
  }

  return issues;
}
