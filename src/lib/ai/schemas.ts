/**
 * Schémas Zod v2 — génération IA guidée par brief structuré.
 *
 * Input : `GenerationBrief` (sujet, audience, objectif, concepts, contraintes,
 * ciblage cours/chapitre optionnel).
 *
 * Output : schéma Zod riche par type — sections, objectives, exemples,
 * keypoints, scénario, critères de réussite. L'approve-route transforme ces
 * champs riches en colonnes DB (lesson.content en MDX, quest.theorySections,
 * quest.missionConfig, etc.).
 *
 * Les minimums sont conservés bas (300 car. pour une leçon) pour que le
 * draft reste utilisable même si l'IA génère court ; l'admin complète à la review.
 */
import { z } from "zod";

/* ============================================================
 * ENUMS PARTAGÉS
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

export const AUDIENCES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const CHALLENGE_FORMATS = ["QUESTION", "QUIZ", "MINI_TASK", "OBSERVATION"] as const;
export type ChallengeFormat = (typeof CHALLENGE_FORMATS)[number];

export const DRAFT_TYPES = ["QUEST", "LESSON", "CHAPTER", "CHALLENGE"] as const;
export type DraftType = (typeof DRAFT_TYPES)[number];

export const MODES = ["NEW", "COURSE_FILL", "ENRICH", "DAILY"] as const;
export type GenerationMode = (typeof MODES)[number];

/* ============================================================
 * INPUT — GenerationBrief
 * ============================================================ */
export const GenerationBriefSchema = z.object({
  type: z.enum(DRAFT_TYPES),
  mode: z.enum(MODES).default("NEW"),
  /** Idée principale fournie par l'admin — champ obligatoire. */
  subject: z.string().min(5, "L'idée principale doit faire au moins 5 caractères.").max(500),
  /** Public cible. Default BEGINNER. */
  audience: z.enum(AUDIENCES).default("BEGINNER"),
  /** Objectif pédagogique explicite (facultatif, mais recommandé). */
  objective: z.string().max(300).optional(),
  /** Notions à aborder (facultatif, séparées par virgule côté UI). */
  concepts: z.array(z.string().min(1).max(60)).max(10).default([]),
  /** Contraintes libres : ton, style, longueur, références à éviter. */
  constraints: z.string().max(500).optional(),
  /** Cours ciblé (slug) pour modes COURSE_FILL et ENRICH. */
  courseSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(60).optional(),
  /** Chapitre ciblé (slug) pour cibler une leçon dans un chapitre précis. */
  chapterSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(60).optional(),
  /** Pour les défis quotidiens : format préféré. */
  challengeFormat: z.enum(CHALLENGE_FORMATS).optional(),
});
export type GenerationBrief = z.infer<typeof GenerationBriefSchema>;

/* ============================================================
 * OUTPUT — QUEST (riche)
 * ============================================================ */
export const QuestDraftSchema = z.object({
  code: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).min(3).max(40),
  track: z.enum(TRACKS),
  order: z.number().int().min(0).max(999),
  title: z.string().min(4).max(80),
  subtitle: z.string().min(10).max(160),
  /** Scénario motivant qui pose le contexte narratif (2-3 phrases). */
  scenario: z.string().min(40).max(400),
  description: z.string().min(40).max(300),
  /** Mission concrète que l'apprenant doit accomplir dans BitLab. */
  mission: z.string().min(30).max(300),
  /** Objectifs pédagogiques — 2 à 5 bullets. */
  objectives: z.array(z.string().min(10).max(200)).min(2).max(5),
  /** Étapes concrètes pour accomplir la mission. */
  steps: z.array(z.string().min(10).max(250)).min(2).max(8),
  /** Critères de réussite vérifiables. */
  successCriteria: z.array(z.string().min(10).max(250)).min(1).max(5),
  /** Introduction pédagogique narrée (≠ scenario). */
  intro: z.string().min(100).max(1500),
  xpReward: z.number().int().min(10).max(500),
  satsReward: z.number().int().min(0).max(2000),
  requiredLevel: z.number().int().min(1).max(10),
  missionType: z.enum(MISSION_TYPES),
  missionKind: z.enum(["SIMULATED"]),
});
export type QuestDraft = z.infer<typeof QuestDraftSchema>;

/* ============================================================
 * OUTPUT — LESSON (riche)
 * ============================================================ */
export const LessonSectionSchema = z.object({
  heading: z.string().min(2).max(120),
  body: z.string().min(50).max(2000),
  /** Exemple concret rattaché à la section (facultatif). */
  example: z.string().max(600).optional(),
});

export const LessonDraftSchema = z.object({
  chapterSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).min(3).max(60),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).min(3).max(60),
  title: z.string().min(4).max(80),
  summary: z.string().min(20).max(240),
  /** Introduction d'ouverture. */
  intro: z.string().min(50).max(800),
  /** Objectifs d'apprentissage (bullets). */
  objectives: z.array(z.string().min(10).max(200)).min(2).max(5),
  /** Sections principales enchaînées. */
  sections: z.array(LessonSectionSchema).min(2).max(6),
  /** Points essentiels à retenir. */
  keypoints: z.array(z.string().min(10).max(200)).min(2).max(6),
  /** Conclusion / ouverture. */
  conclusion: z.string().min(40).max(500),
  /** Questions de compréhension (optionnel). */
  comprehensionQuestions: z
    .array(
      z.object({
        question: z.string().min(10).max(300),
        answer: z.string().min(5).max(500),
      }),
    )
    .max(5)
    .optional(),
  estimatedMinutes: z.number().int().min(2).max(30),
  order: z.number().int().min(0).max(999),
});
export type LessonDraft = z.infer<typeof LessonDraftSchema>;

/* ============================================================
 * OUTPUT — CHAPTER (riche)
 * ============================================================ */
export const ChapterDraftSchema = z.object({
  courseSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).min(3).max(60),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).min(3).max(60),
  title: z.string().min(4).max(80),
  summary: z.string().min(20).max(240),
  /** Objectif pédagogique global du chapitre. */
  objective: z.string().min(20).max(300),
  /** Progression suggérée : titres des leçons à créer, dans l'ordre. */
  lessonsPlan: z.array(z.string().min(5).max(120)).min(2).max(8),
  order: z.number().int().min(0).max(999),
});
export type ChapterDraft = z.infer<typeof ChapterDraftSchema>;

/* ============================================================
 * OUTPUT — CHALLENGE (riche)
 * ============================================================ */
export const ChallengeDraftSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(4).max(80),
  /** Format du défi — guide le rendu UI. */
  format: z.enum(CHALLENGE_FORMATS),
  /** Consigne complète. Peut contenir des markdown léger. */
  prompt: z.string().min(50).max(1000),
  /** Attendu / réponse de référence (admin-only, utile pour review). */
  expectedAnswer: z.string().min(5).max(400).optional(),
  /** Difficulté. */
  difficulty: z.enum(AUDIENCES),
  xpReward: z.number().int().min(5).max(200),
  satsReward: z.number().int().min(0).max(500),
});
export type ChallengeDraft = z.infer<typeof ChallengeDraftSchema>;

/* ============================================================
 * MAP + GUARDS
 * ============================================================ */
export const DRAFT_SCHEMA_BY_TYPE = {
  QUEST: QuestDraftSchema,
  LESSON: LessonDraftSchema,
  CHAPTER: ChapterDraftSchema,
  CHALLENGE: ChallengeDraftSchema,
} as const;

export function isDraftType(v: unknown): v is DraftType {
  return typeof v === "string" && (DRAFT_TYPES as readonly string[]).includes(v);
}

/* ============================================================
 * INPUT — ADMIN REQUEST SCHEMAS
 * Schémas Zod pour les routes POST /api/admin/ai/**
 * ============================================================ */

/** POST /api/admin/ai/config — upsert la cadence d'un type de génération. */
export const AIConfigPostSchema = z.object({
  type: z.enum(DRAFT_TYPES),
  enabled: z.boolean().optional(),
  cadenceHours: z.number().int().min(1).max(24 * 30).optional(),
  maxPerRun: z.number().int().min(1).max(5).optional(),
  hint: z.string().trim().max(500).nullable().optional(),
});
export type AIConfigPostInput = z.infer<typeof AIConfigPostSchema>;

/** POST /api/admin/ai/{chapters,lessons}/[id]/related */
export const AIRelatedPostSchema = z.object({
  kind: z.enum(["QUEST", "CHALLENGE"]),
  subject: z.string().trim().min(5).max(500).optional(),
  audience: z.enum(AUDIENCES).optional(),
  challengeFormat: z.enum(CHALLENGE_FORMATS).optional(),
});
export type AIRelatedPostInput = z.infer<typeof AIRelatedPostSchema>;

/** POST /api/admin/ai/chapters/[id]/cascade */
export const AICascadePostSchema = z.object({
  titles: z.array(z.string()).min(1, "Au moins un titre requis."),
  audience: z.enum(AUDIENCES).optional(),
  objective: z.string().trim().max(500).optional(),
  skipExisting: z.boolean().optional(),
});
export type AICascadePostInput = z.infer<typeof AICascadePostSchema>;

/** POST /api/admin/ai/drafts/[id]/reject */
export const AIDraftRejectSchema = z.object({
  reason: z.string().trim().max(500).nullable().optional(),
});
export type AIDraftRejectInput = z.infer<typeof AIDraftRejectSchema>;

/** POST /api/admin/ai/drafts/[id]/approve */
export const AIDraftApproveSchema = z.object({
  overrides: z.record(z.string(), z.unknown()).optional(),
});
export type AIDraftApproveInput = z.infer<typeof AIDraftApproveSchema>;

/**
 * POST /api/admin/ai/generate/[type] — le `type` vient de l'URL donc on
 * accepte un body sans `type` et on le fusionne avant la revalidation stricte
 * via `GenerationBriefSchema`. Schéma minimal ici : on accepte tout objet.
 */
export const AIGenerateBodySchema = z.record(z.string(), z.unknown());
