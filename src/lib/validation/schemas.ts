import { z } from "zod";

/* ============================================================
 * Validation Zod — frontières d'API BitQuest.
 *
 * Chaque route POST importe le schéma dédié et appelle
 * `parseJsonBody(req, schema)` pour obtenir un payload typé OU une
 * Response 400 avec un message formaté.
 * ============================================================ */

/* ---------- /api/auth ---------- */

export const authRegisterSchema = z.object({
  action: z.literal("register"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^\S+@\S+\.\S+$/, "Adresse email invalide."),
  pseudo: z.string().trim().min(3, "Le pseudo doit contenir au moins 3 caractères.").max(20, "Le pseudo doit contenir au plus 20 caractères."),
  password: z.string().min(10, "Le mot de passe doit contenir au moins 10 caractères."),
});

export const authLoginSchema = z.object({
  action: z.literal("login"),
  email: z.string().trim().toLowerCase(),
  password: z.string(),
});

export const authGuestSchema = z.object({
  action: z.literal("guest"),
});

export const authBodySchema = z.discriminatedUnion("action", [
  authRegisterSchema,
  authLoginSchema,
  authGuestSchema,
]);

export type AuthBody = z.infer<typeof authBodySchema>;

/* ---------- /api/quests/[code]/progress ---------- */

const progressStartSchema = z.object({ action: z.literal("start") });

const progressReadSectionSchema = z.object({
  action: z.literal("read_section"),
  sectionIndex: z.number().int().nonnegative(),
});

const progressQuizSubmitSchema = z.object({
  action: z.literal("quiz_submit"),
  answers: z.array(z.union([z.number(), z.boolean()])),
});

const progressMissionStartSchema = z.object({ action: z.literal("mission_start") });

const progressMissionSubmitSchema = z.object({
  action: z.literal("mission_submit"),
  answer: z.record(z.string(), z.unknown()).default({}),
});

export const questProgressBodySchema = z.discriminatedUnion("action", [
  progressStartSchema,
  progressReadSectionSchema,
  progressQuizSubmitSchema,
  progressMissionStartSchema,
  progressMissionSubmitSchema,
]);

export type QuestProgressBody = z.infer<typeof questProgressBodySchema>;

/* ---------- /api/admin/users/[id]/role ---------- */

export const adminChangeRoleSchema = z.object({
  role: z.enum(["APPRENTICE", "EDITOR", "ADMIN"]),
});

export type AdminChangeRoleBody = z.infer<typeof adminChangeRoleSchema>;

/* ---------- /api/admin/courses ---------- */

/** Slug : kebab-case ASCII, 2-80 caractères, ne commence/termine pas par -. */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Le slug doit contenir au moins 2 caractères.")
  .max(80, "Le slug est trop long (80 max).")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Le slug doit être en kebab-case (ex. mon-cours).");

/**
 * Horodatage ISO ou null. Un cours publié a `publishedAt` non null.
 * L'entrée peut être `null`, une string ISO parse-able, ou absente (undefined).
 */
const publishedAtSchema = z
  .union([z.string().datetime({ message: "Date ISO 8601 attendue." }), z.null()])
  .optional();

export const adminCourseCreateSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(2).max(120),
  subtitle: z.string().trim().min(2).max(240),
  description: z.string().trim().min(2).max(2000),
  coverIcon: z.string().trim().min(1).max(40).default("BookOpen"),
  order: z.number().int().nonnegative().default(0),
  publishedAt: publishedAtSchema,
});

export type AdminCourseCreateBody = z.infer<typeof adminCourseCreateSchema>;

export const adminCourseUpdateSchema = z.object({
  slug: slugSchema.optional(),
  title: z.string().trim().min(2).max(120).optional(),
  subtitle: z.string().trim().min(2).max(240).optional(),
  description: z.string().trim().min(2).max(2000).optional(),
  coverIcon: z.string().trim().min(1).max(40).optional(),
  order: z.number().int().nonnegative().optional(),
  publishedAt: publishedAtSchema,
});

export type AdminCourseUpdateBody = z.infer<typeof adminCourseUpdateSchema>;

/* ---------- /api/admin/courses/[courseId]/chapters + /api/admin/chapters/[id] ---------- */

export const adminChapterCreateSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(2).max(500),
  order: z.number().int().nonnegative().default(0),
});

export type AdminChapterCreateBody = z.infer<typeof adminChapterCreateSchema>;

export const adminChapterUpdateSchema = z.object({
  slug: slugSchema.optional(),
  title: z.string().trim().min(2).max(120).optional(),
  summary: z.string().trim().min(2).max(500).optional(),
  order: z.number().int().nonnegative().optional(),
});

export type AdminChapterUpdateBody = z.infer<typeof adminChapterUpdateSchema>;

/* ---------- /api/admin/chapters/[chapterId]/lessons + /api/admin/lessons/[id] ---------- */

export const adminLessonCreateSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(2).max(500),
  content: z.string().trim().min(2).max(50_000), // Markdown
  estimatedMinutes: z.number().int().positive().max(240).default(5),
  order: z.number().int().nonnegative().default(0),
  publishedAt: publishedAtSchema,
});

export type AdminLessonCreateBody = z.infer<typeof adminLessonCreateSchema>;

export const adminLessonUpdateSchema = z.object({
  slug: slugSchema.optional(),
  title: z.string().trim().min(2).max(120).optional(),
  summary: z.string().trim().min(2).max(500).optional(),
  content: z.string().trim().min(2).max(50_000).optional(),
  estimatedMinutes: z.number().int().positive().max(240).optional(),
  order: z.number().int().nonnegative().optional(),
  publishedAt: publishedAtSchema,
});

export type AdminLessonUpdateBody = z.infer<typeof adminLessonUpdateSchema>;

/* ---------- /api/admin/quests + /api/admin/quests/[code] ---------- */

export const QUEST_TRACKS = ["INITIATION", "INTERMEDIATE", "ADVANCED", "SPECIAL"] as const;

export const QUEST_MISSION_KINDS = ["SIMULATED", "BITLAB_PROOF"] as const;

/**
 * Déclaré ici (avant `adminQuestCreateSchema`) pour éviter une dépendance
 * forward au bloc mission plus bas. Dupliqué dans `/api/admin/quests/
 * [code]/mission` export ci-dessous — valeur canonique, on réexporte.
 */
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

/** Code quête : identifiant stable public (kebab-case ASCII, 2-60 chars). */
const questCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Le code doit contenir au moins 2 caractères.")
  .max(60, "Le code est trop long (60 max).")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Le code doit être en kebab-case (ex. tx-basics).");

/**
 * Création d'une quête (POST /api/admin/quests). Seule une shape minimale
 * est exigée ; les parties riches (théorie, quiz, mission config) se
 * remplissent ensuite via les builders dédiés.
 *
 * - `code` doit être unique en base (409 sinon).
 * - `theorySections` est semi-optionnel : non fourni → `[]` sérialisé.
 * - `missionConfig` est semi-optionnel : non fourni → `{ brief: "", hint: "" }`.
 * - `missionKind` par défaut `SIMULATED` (BITLAB_PROOF s'enclenche quand
 *   la mission est explicitement reliée à une preuve on-chain).
 */
export const adminQuestCreateSchema = z.object({
  code: questCodeSchema,
  track: z.enum(QUEST_TRACKS),
  order: z.number().int().nonnegative().max(1_000),
  title: z.string().trim().min(2).max(120),
  subtitle: z.string().trim().min(2).max(240),
  description: z.string().trim().min(2).max(2000),
  intro: z.string().trim().min(2).max(2000),
  xpReward: z.number().int().nonnegative().max(10_000).default(0),
  satsReward: z.number().int().nonnegative().max(1_000_000).default(0),
  requiredLevel: z.number().int().positive().max(10).default(1),
  missionType: z.enum(MISSION_TYPES),
  missionKind: z.enum(QUEST_MISSION_KINDS).default("SIMULATED"),
});

export type AdminQuestCreateBody = z.infer<typeof adminQuestCreateSchema>;

/**
 * Patch des métadonnées d'une quête.
 * - `code` n'est PAS éditable (ancre publique + clé des badges QUEST_COMPLETE).
 * - `theorySections` / `quiz` / `missionConfig` sont gérés dans des éditeurs
 *   dédiés à venir (Phase 2.6b).
 */
export const adminQuestUpdateSchema = z.object({
  track: z.enum(QUEST_TRACKS).optional(),
  order: z.number().int().nonnegative().optional(),
  title: z.string().trim().min(2).max(120).optional(),
  subtitle: z.string().trim().min(2).max(240).optional(),
  description: z.string().trim().min(2).max(2000).optional(),
  intro: z.string().trim().min(2).max(2000).optional(),
  xpReward: z.number().int().nonnegative().max(10_000).optional(),
  satsReward: z.number().int().nonnegative().max(1_000_000).optional(),
  requiredLevel: z.number().int().positive().max(10).optional(),
});

export type AdminQuestUpdateBody = z.infer<typeof adminQuestUpdateSchema>;

/* ---------- /api/admin/quests/[code]/theory ---------- */

/**
 * Une section théorique d'une quête. `keypoints` peut être vide.
 * Le total sérialisé est borné à ~80 KB pour éviter les JSON extrêmes.
 */
const theorySectionSchema = z.object({
  title: z.string().trim().min(1, "Titre requis.").max(200),
  body: z.string().trim().min(1, "Corps requis.").max(10_000),
  keypoints: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
});

export const adminQuestTheorySchema = z
  .object({
    sections: z.array(theorySectionSchema).min(1, "Au moins une section est requise.").max(12),
  })
  .refine(
    (v) => JSON.stringify(v.sections).length <= 80_000,
    { message: "Les sections dépassent la taille maximale (80 KB sérialisés)." },
  );

export type AdminQuestTheoryBody = z.infer<typeof adminQuestTheorySchema>;
export type TheorySection = z.infer<typeof theorySectionSchema>;

/* ---------- /api/admin/quests/[code]/quiz ---------- */

const mcqQuestionSchema = z
  .object({
    type: z.literal("MCQ"),
    question: z.string().trim().min(1, "Question requise.").max(500),
    options: z
      .array(z.string().trim().min(1).max(200))
      .min(2, "MCQ : au moins 2 options requises.")
      .max(6, "MCQ : maximum 6 options."),
    correctIndex: z.number().int().nonnegative(),
    explanation: z.string().trim().min(1, "Explication requise.").max(1000),
  })
  .refine((d) => d.correctIndex < d.options.length, {
    message: "correctIndex doit pointer vers une option existante.",
    path: ["correctIndex"],
  });

const trueFalseQuestionSchema = z.object({
  type: z.literal("TRUE_FALSE"),
  question: z.string().trim().min(1, "Question requise.").max(500),
  correctBool: z.boolean(),
  explanation: z.string().trim().min(1, "Explication requise.").max(1000),
});

export const quizQuestionSchema = z.discriminatedUnion("type", [
  mcqQuestionSchema,
  trueFalseQuestionSchema,
]);

export const adminQuestQuizSchema = z.object({
  questions: z
    .array(quizQuestionSchema)
    .min(1, "Au moins une question est requise.")
    .max(20, "Maximum 20 questions par quête."),
});

export type AdminQuestQuizBody = z.infer<typeof adminQuestQuizSchema>;
export type QuizQuestionInput = z.infer<typeof quizQuestionSchema>;

/* ---------- /api/admin/quests/[code]/mission ---------- */

// MISSION_TYPES est désormais défini en tête de section quests (ligne ~180)
// pour satisfaire la référence depuis `adminQuestCreateSchema`. On garde
// un commentaire ici pour pointer vers l'endroit canonique.

/**
 * Configuration mission : type + texte (brief, hint) + bag JSON type-spécifique.
 *
 * - `missionType` : l'un des 8 générateurs supportés par missions.ts.
 * - `brief` / `hint` : texte affiché à l'apprenant (champs standard de
 *   l'enveloppe missionConfig telle que générée au seed).
 * - `config` : objet libre que generateMission(type, config) consomme
 *   (target, feeSats, policy, …). Le shape dépend du type mais reste
 *   permissif ici — les builders dédiés par type pourront arriver plus
 *   tard sans invalider les configs existantes.
 */
export const adminQuestMissionSchema = z
  .object({
    missionType: z.enum(MISSION_TYPES),
    brief: z.string().trim().min(1, "Brief requis.").max(2000),
    hint: z.string().trim().max(1000).default(""),
    config: z.record(z.string(), z.unknown()).default({}),
  })
  .refine(
    (v) => JSON.stringify({ ...v.config, brief: v.brief, hint: v.hint }).length <= 20_000,
    { message: "La mission config sérialisée dépasse 20 KB." },
  );

export type AdminQuestMissionBody = z.infer<typeof adminQuestMissionSchema>;

/* ---------- /api/admin/team-members ---------- */

/**
 * Validation CRUD membres de l'équipe GandalNexus (landing publique).
 * - `initials` : 1 à 4 caractères (fallback avatar).
 * - `avatarUrl` : URL http(s) optionnelle.
 * - `publishedAt` : ISO string | null (brouillon).
 */
const teamMemberCoreSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court.").max(80, "Nom trop long."),
  role: z.string().trim().min(2).max(120),
  contribution: z.string().trim().min(2).max(1000),
  initials: z
    .string()
    .trim()
    .min(1, "Initiales requises.")
    .max(4, "Max 4 caractères."),
  avatarUrl: z
    .string()
    .trim()
    .url("URL invalide.")
    .max(500)
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  order: z.number().int().nonnegative().max(1_000).default(0),
  publishedAt: z.string().datetime().nullable().optional(),
});

export const adminTeamMemberCreateSchema = teamMemberCoreSchema;

export const adminTeamMemberUpdateSchema = teamMemberCoreSchema.partial();

export type AdminTeamMemberCreateBody = z.infer<typeof adminTeamMemberCreateSchema>;
export type AdminTeamMemberUpdateBody = z.infer<typeof adminTeamMemberUpdateSchema>;

/* ============================================================
 * Partenaires / sponsors (landing /gandalnexus)
 * ============================================================ */

export const PARTNER_TIERS = ["SPONSOR", "PARTNER", "SUPPORTER"] as const;
export type PartnerTier = (typeof PARTNER_TIERS)[number];

const partnerCoreSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court.").max(80, "Nom trop long."),
  tier: z.enum(PARTNER_TIERS),
  description: z.string().trim().min(2).max(500),
  websiteUrl: z
    .string()
    .trim()
    .url("URL invalide.")
    .max(500)
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  logoUrl: z
    .string()
    .trim()
    .url("URL invalide.")
    .max(500)
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  initials: z
    .string()
    .trim()
    .min(1, "Initiales requises.")
    .max(4, "Max 4 caractères."),
  order: z.number().int().nonnegative().max(1_000).default(0),
  publishedAt: z.string().datetime().nullable().optional(),
});

export const adminPartnerCreateSchema = partnerCoreSchema;
export const adminPartnerUpdateSchema = partnerCoreSchema.partial();

export type AdminPartnerCreateBody = z.infer<typeof adminPartnerCreateSchema>;
export type AdminPartnerUpdateBody = z.infer<typeof adminPartnerUpdateSchema>;

/* ---------- /api/admin/landing-config ---------- */

// URL validator restrictive mais pratique : http(s), longueur bornée.
// Accepte localhost pour le dev. Rejette les schemas exotiques
// (javascript:, data:, file:…) via l'allow-list sur protocol.
const landingUrlSchema = z
  .string()
  .trim()
  .min(1, "URL requise.")
  .max(2048, "URL trop longue (max 2048).")
  .refine(
    (v) => {
      try {
        const u = new URL(v);
        return u.protocol === "https:" || u.protocol === "http:";
      } catch {
        return false;
      }
    },
    { message: "URL invalide : http(s) requis." },
  );

// Optionnels : accepte "" (vide = effacer la valeur) ou une URL valide.
// Transformés en `null` côté API avant persistance pour que le landing
// masque le slot UI correspondant.
const optionalLandingUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (v) => {
      if (v.length === 0) return true;
      try {
        const u = new URL(v);
        return u.protocol === "https:" || u.protocol === "http:";
      } catch {
        return false;
      }
    },
    { message: "URL invalide : http(s) requis ou champ vide pour effacer." },
  );

const optionalEmailSchema = z
  .string()
  .trim()
  .max(320)
  .refine(
    (v) => v.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    { message: "Email invalide ou champ vide pour effacer." },
  );

// Nostr pubkey : hex 64 chars OU npub1... (bech32, 63 chars typiquement).
// Format strict mais permissif pour les deux encodages canoniques.
const optionalNostrSchema = z
  .string()
  .trim()
  .max(128)
  .refine(
    (v) =>
      v.length === 0 ||
      /^[0-9a-f]{64}$/i.test(v) ||
      /^npub1[a-z0-9]{50,70}$/.test(v),
    {
      message:
        "Nostr pubkey : hex (64 chars) ou npub1… bech32, ou champ vide.",
    },
  );

export const adminLandingConfigUpdateSchema = z.object({
  bitquestUrl: landingUrlSchema,
  bitlabUrl: landingUrlSchema,
  landingUrl: landingUrlSchema,
  githubOrgUrl: landingUrlSchema,
  verifyUrl: landingUrlSchema,
  contactEmail: optionalEmailSchema,
  twitterUrl: optionalLandingUrlSchema,
  nostrPubkey: optionalNostrSchema,
  docsUrl: optionalLandingUrlSchema,
});

export type AdminLandingConfigUpdateBody = z.infer<typeof adminLandingConfigUpdateSchema>;

/* ---------- /api/admin/badges ---------- */

export const BADGE_RARITIES = ["COMMON", "RARE", "EPIC"] as const;

export const BADGE_CONDITION_TYPES = [
  "QUEST_COMPLETE",
  "QUEST_COUNT",
  "TRACK_COMPLETE",
  "STREAK",
  "LEVEL",
  "SATS_TOTAL",
  "PERFECT_QUIZ",
] as const;

/** Code badge : identifiant stable (kebab-case ASCII, 2-60 caractères). */
const badgeCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Le code doit contenir au moins 2 caractères.")
  .max(60, "Le code est trop long (60 max).")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Le code doit être en kebab-case (ex. first-quest).");

export const adminBadgeCreateSchema = z.object({
  code: badgeCodeSchema,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(500),
  icon: z.string().trim().min(1).max(40),
  rarity: z.enum(BADGE_RARITIES),
  conditionType: z.enum(BADGE_CONDITION_TYPES),
  conditionValue: z.record(z.string(), z.unknown()).default({}),
});

export type AdminBadgeCreateBody = z.infer<typeof adminBadgeCreateSchema>;

/** Patch : code immuable (référencé par UserBadge + usages hors-DB). */
export const adminBadgeUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().min(2).max(500).optional(),
  icon: z.string().trim().min(1).max(40).optional(),
  rarity: z.enum(BADGE_RARITIES).optional(),
  conditionType: z.enum(BADGE_CONDITION_TYPES).optional(),
  conditionValue: z.record(z.string(), z.unknown()).optional(),
});

export type AdminBadgeUpdateBody = z.infer<typeof adminBadgeUpdateSchema>;

/* ---------- /api/admin/challenges ---------- */

/** Date ISO day stricte "YYYY-MM-DD" (pas de timestamp, pas de timezone). */
export const isoDaySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date attendu : YYYY-MM-DD.")
  .refine(
    (v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
    },
    { message: "Date calendaire invalide (vérifier mois/jour)." },
  );

export const adminChallengeCreateSchema = z.object({
  date: isoDaySchema,
  title: z.string().trim().min(2).max(120),
  prompt: z.string().trim().min(10).max(2000),
  xpReward: z.number().int().nonnegative().max(500).default(10),
  satsReward: z.number().int().nonnegative().max(500).default(50),
});

export type AdminChallengeCreateBody = z.infer<typeof adminChallengeCreateSchema>;

export const adminChallengeUpdateSchema = z.object({
  date: isoDaySchema.optional(),
  title: z.string().trim().min(2).max(120).optional(),
  prompt: z.string().trim().min(10).max(2000).optional(),
  xpReward: z.number().int().nonnegative().max(500).optional(),
  satsReward: z.number().int().nonnegative().max(500).optional(),
});

export type AdminChallengeUpdateBody = z.infer<typeof adminChallengeUpdateSchema>;

/* ---------- /api/me/password ---------- */

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis."),
  newPassword: z
    .string()
    .min(10, "Le nouveau mot de passe doit contenir au moins 10 caractères.")
    .max(200, "Mot de passe trop long."),
});

export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;

/* ---------- /api/me/delete ---------- */

/**
 * Suppression RGPD. Les comptes enregistrés doivent confirmer avec leur
 * mot de passe courant ; les guests peuvent supprimer sans mot de passe
 * (ils n'en ont pas) mais la chaîne "DELETE" doit correspondre.
 */
export const deleteAccountSchema = z.object({
  confirmation: z.literal("DELETE", { message: 'Tape "DELETE" pour confirmer.' }),
  currentPassword: z.string().optional(),
});

export type DeleteAccountBody = z.infer<typeof deleteAccountSchema>;

/* ---------- /api/auth/verify-launch-token ---------- */

/**
 * Vérification d'un launch token GandalNexus par BitLab (server-to-server).
 * Body minimal : `{ token }`. Pas d'autre champ — tout vient du JWT.
 */
export const verifyLaunchTokenSchema = z.object({
  token: z.string().min(32, "Launch token invalide.").max(4096),
});

export type VerifyLaunchTokenBody = z.infer<typeof verifyLaunchTokenSchema>;

/* ---------- /api/bitlab/proof ---------- */

export const BITLAB_NETWORKS = ["testnet4", "signet", "regtest"] as const;
export const BITLAB_PROOF_KINDS = ["TX", "BLOCK", "INVOICE", "CHANNEL", "ADDRESS"] as const;

/**
 * Soumission d'une preuve de mission. Shape volontairement permissive sur
 * le payload : chaque kind a ses champs attendus et la validation métier
 * (vérif mempool / décodage BOLT11) vit dans le handler, pas le schema.
 */
export const bitlabProofSchema = z.object({
  questCode: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "questCode doit être en kebab-case."),
  kind: z.enum(BITLAB_PROOF_KINDS),
  network: z.enum(BITLAB_NETWORKS),
  payload: z.record(z.string(), z.unknown()).default({}),
  /**
   * JWT challenge obligatoire (Phase 3 hardening). Émis par
   * /api/bitlab/challenge, vérifié + nonce consommé (Redis).
   */
  challenge: z.string().min(16, "JWT challenge requis."),
});

export type BitlabProofBody = z.infer<typeof bitlabProofSchema>;

/* ---------- /api/bitlab/challenge ---------- */

export const bitlabChallengeSchema = z.object({
  questCode: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "questCode doit être en kebab-case."),
  kind: z.enum(BITLAB_PROOF_KINDS),
  /**
   * ID de MissionAttempt émis par /api/bitlab/deep-link. Optionnel : les
   * clients qui appellent directement challenge (hors deep-link) peuvent
   * l'omettre, mais la tentative ne sera pas tracée côté dashboard.
   */
  attemptId: z.string().trim().min(1).max(64).optional(),
});

export type BitlabChallengeBody = z.infer<typeof bitlabChallengeSchema>;

/* ---------- /api/bitlab/deep-link ---------- */

export const bitlabDeepLinkSchema = z.object({
  questCode: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "questCode doit être en kebab-case."),
  kind: z.enum(BITLAB_PROOF_KINDS),
  network: z.enum(BITLAB_NETWORKS),
  returnTo: z.string().url("returnTo doit être une URL absolue."),
});

export type BitlabDeepLinkBody = z.infer<typeof bitlabDeepLinkSchema>;

/**
 * Action sur une MissionAttempt (LOT 1). Pour l'instant, seul `abandon`
 * est accepté : les transitions terminales serveur (COMPLETED, FAILED,
 * EXPIRED) ne sont pas exposées au client.
 */
export const bitlabAttemptActionSchema = z.object({
  action: z.literal("abandon"),
});

export type BitlabAttemptActionBody = z.infer<typeof bitlabAttemptActionSchema>;

export const bitlabDeepLinkVerifySchema = z.object({
  questCode: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "questCode doit être en kebab-case."),
  kind: z.enum(BITLAB_PROOF_KINDS),
  network: z.enum(BITLAB_NETWORKS),
  ts: z.number().int().positive(),
  sig: z.string().min(16).max(128),
  /**
   * Version du protocole lue depuis l'URL de retour BitLab. Facultatif
   * pour supporter les URLs émises avant P0.3 (fallback legacy côté verify).
   */
  v: z.number().int().positive().max(999).optional(),
});

export type BitlabDeepLinkVerifyBody = z.infer<typeof bitlabDeepLinkVerifySchema>;

/* ---------- /api/auth/verify-email ---------- */

export const verifyEmailSchema = z.object({
  token: z.string().trim().min(16).max(128),
});

export type VerifyEmailBody = z.infer<typeof verifyEmailSchema>;

/* ---------- Helper générique ---------- */

/**
 * Parse le corps JSON de la requête et le valide contre un schéma Zod.
 * - Succès → `{ ok: true, data }`.
 * - Échec parse / schéma → `{ ok: false, response: Response(400) }` à retourner tel quel.
 */
export async function parseJsonBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Corps JSON invalide." }, { status: 400 }),
    };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const message = first?.message ?? "Payload invalide.";
    return {
      ok: false,
      response: Response.json(
        { error: message, issues: result.error.issues },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: result.data };
}
