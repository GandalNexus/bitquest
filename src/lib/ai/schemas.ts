/**
 * Schémas Zod pour tous les types de contenu générés par IA.
 *
 * Chaque type a : un schéma Zod strict (output_config.format), un system prompt
 * dédié, et une fonction de rendering contextuel (taxonomie / contraintes).
 */
import { z } from "zod";

/* ============================================================
 * QUEST
 * ============================================================ */
export const TRACKS = ["INITIATION", "INTERMEDIATE", "ADVANCED", "SPECIAL"] as const;
export const MISSION_TYPES = [
  "block_explorer",
  "key_forge",
  "tx_builder",
  "mine_nonce",
  "ln_channel",
  "ln_invoice",
  "multisig_sign",
  "taproot_tweak",
] as const;

export const QuestDraftSchema = z.object({
  code: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .min(3)
    .max(40),
  track: z.enum(TRACKS),
  order: z.number().int().min(0).max(999),
  title: z.string().min(4).max(80),
  subtitle: z.string().min(10).max(160),
  description: z.string().min(40).max(300),
  intro: z.string().min(100).max(1200),
  xpReward: z.number().int().min(10).max(500),
  satsReward: z.number().int().min(0).max(2000),
  requiredLevel: z.number().int().min(1).max(10),
  missionType: z.enum(MISSION_TYPES),
  missionKind: z.enum(["SIMULATED"]),
});
export type QuestDraft = z.infer<typeof QuestDraftSchema>;

/* ============================================================
 * LESSON (contenu MDX court rattaché à un chapitre)
 * ============================================================ */
export const LessonDraftSchema = z.object({
  chapterSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).min(3).max(60),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).min(3).max(60),
  title: z.string().min(4).max(80),
  summary: z.string().min(20).max(240),
  content: z.string().min(300).max(5000),
  estimatedMinutes: z.number().int().min(2).max(30),
  order: z.number().int().min(0).max(999),
});
export type LessonDraft = z.infer<typeof LessonDraftSchema>;

/* ============================================================
 * CHAPTER (regroupement de leçons dans un cours)
 * ============================================================ */
export const ChapterDraftSchema = z.object({
  courseSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).min(3).max(60),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).min(3).max(60),
  title: z.string().min(4).max(80),
  summary: z.string().min(20).max(240),
  order: z.number().int().min(0).max(999),
});
export type ChapterDraft = z.infer<typeof ChapterDraftSchema>;

/* ============================================================
 * CHALLENGE (défi quotidien, 1 jour = 1 défi)
 * ============================================================ */
export const ChallengeDraftSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(4).max(80),
  prompt: z.string().min(50).max(800),
  xpReward: z.number().int().min(5).max(200),
  satsReward: z.number().int().min(0).max(500),
});
export type ChallengeDraft = z.infer<typeof ChallengeDraftSchema>;

/* ============================================================
 * Discriminated union exposé à l'API.
 * ============================================================ */
export const DRAFT_TYPES = ["QUEST", "LESSON", "CHAPTER", "CHALLENGE"] as const;
export type DraftType = (typeof DRAFT_TYPES)[number];

export const DRAFT_SCHEMA_BY_TYPE = {
  QUEST: QuestDraftSchema,
  LESSON: LessonDraftSchema,
  CHAPTER: ChapterDraftSchema,
  CHALLENGE: ChallengeDraftSchema,
} as const;

export function isDraftType(v: unknown): v is DraftType {
  return typeof v === "string" && (DRAFT_TYPES as readonly string[]).includes(v);
}
