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
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères."),
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
