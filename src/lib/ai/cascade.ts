/**
 * Cascade de génération : à partir d'un chapitre + liste de titres de leçons,
 * déclenche une génération LESSON par item. Idempotent : skip les titres déjà
 * couverts par un AIDraft PENDING/APPROVED ou une Lesson publiée.
 *
 * Design :
 *   - Déduplication robuste : on compare les titres normalisés (lowercase +
 *     trim + accents strippés) — l'IA peut varier légèrement.
 *   - Séquentiel : une leçon à la fois pour tenir compte de la précédente
 *     dans le contexte de la suivante (évite doublons sémantiques).
 *   - Non-bloquant : si une leçon échoue, on continue les autres.
 */
import { db } from "@/lib/db";
import { generateDraft } from "./generate";
import { loadTaxonomy } from "./context";
import { checkConformity } from "./validate";
import { GenerationBriefSchema, type LessonDraft } from "./schemas";

export interface CascadeItemResult {
  title: string;
  status: "generated" | "skipped_draft_exists" | "skipped_lesson_published" | "error";
  draftId?: string;
  reason?: string;
}

export interface CascadeResult {
  chapterId: string;
  totalPlan: number;
  generated: number;
  skipped: number;
  errored: number;
  items: CascadeItemResult[];
}

export interface CascadeOptions {
  chapterId: string;
  titles: string[];
  audience?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  objective?: string;
  skipExisting?: boolean;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function runLessonCascade(opts: CascadeOptions): Promise<CascadeResult> {
  const chapter = await db.chapter.findUnique({
    where: { id: opts.chapterId },
    include: {
      course: { select: { slug: true, title: true } },
      lessons: { select: { title: true, slug: true } },
    },
  });
  if (!chapter) throw new Error(`Chapitre introuvable : ${opts.chapterId}`);

  // Ensemble des titres déjà couverts (publiés ou drafts PENDING/APPROVED).
  const publishedTitles = new Set(chapter.lessons.map((l) => normalize(l.title)));
  const existingDrafts = await db.aIDraft.findMany({
    where: {
      type: "LESSON",
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: { id: true, payload: true, status: true },
  });
  const draftTitles = new Map<string, { id: string; status: string }>();
  for (const d of existingDrafts) {
    try {
      const parsed = JSON.parse(d.payload) as Partial<LessonDraft>;
      if (parsed.chapterSlug === chapter.slug && typeof parsed.title === "string") {
        draftTitles.set(normalize(parsed.title), { id: d.id, status: d.status });
      }
    } catch {
      // ignore malformed
    }
  }

  const items: CascadeItemResult[] = [];
  const skipExisting = opts.skipExisting !== false; // default true

  // Charge taxonomy une seule fois (immuable sur la durée de la cascade).
  const taxonomy = await loadTaxonomy("LESSON");

  for (const rawTitle of opts.titles) {
    const title = rawTitle.trim();
    if (!title) continue;
    const norm = normalize(title);

    if (skipExisting) {
      if (publishedTitles.has(norm)) {
        items.push({ title, status: "skipped_lesson_published" });
        continue;
      }
      const existing = draftTitles.get(norm);
      if (existing) {
        items.push({ title, status: "skipped_draft_exists", draftId: existing.id });
        continue;
      }
    }

    const briefParse = GenerationBriefSchema.safeParse({
      type: "LESSON",
      mode: "ENRICH",
      subject: title,
      audience: opts.audience ?? "BEGINNER",
      objective: opts.objective,
      concepts: [],
      courseSlug: chapter.course.slug,
      chapterSlug: chapter.slug,
    });
    if (!briefParse.success) {
      items.push({
        title,
        status: "error",
        reason: briefParse.error.issues[0]?.message ?? "brief invalide",
      });
      continue;
    }

    try {
      const result = await generateDraft({ type: "LESSON", brief: briefParse.data, taxonomy });
      const issues = checkConformity("LESSON", result.draft);
      const errors = issues.filter((i) => i.severity === "error");
      if (errors.length > 0) {
        items.push({
          title,
          status: "error",
          reason: `conformity: ${errors[0].message}`,
        });
        continue;
      }
      const warnings = issues.filter((i) => i.severity === "warning");

      const draft = await db.aIDraft.create({
        data: {
          type: "LESSON",
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

      // Enregistre côté dédoublonnage pour les prochaines itérations
      // (évite de regénérer la même leçon si deux titres se recoupent).
      draftTitles.set(normalize(result.draft.title), { id: draft.id, status: "PENDING" });
      items.push({ title, status: "generated", draftId: draft.id });
    } catch (err) {
      items.push({
        title,
        status: "error",
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const generated = items.filter((i) => i.status === "generated").length;
  const skipped = items.filter((i) => i.status.startsWith("skipped")).length;
  const errored = items.filter((i) => i.status === "error").length;

  return {
    chapterId: opts.chapterId,
    totalPlan: opts.titles.filter((t) => t.trim().length > 0).length,
    generated,
    skipped,
    errored,
    items,
  };
}

/**
 * Récupère le plan d'un chapitre depuis son AIDraft d'origine, s'il existe.
 * Retourne un array de titres suggérés par Claude lors de la génération.
 */
export async function loadChapterPlan(chapterId: string): Promise<string[]> {
  const draft = await db.aIDraft.findFirst({
    where: {
      type: "CHAPTER",
      status: "APPROVED",
      publishedId: chapterId,
    },
    orderBy: { reviewedAt: "desc" },
  });
  if (!draft) return [];
  try {
    const parsed = JSON.parse(draft.payload) as { lessonsPlan?: unknown };
    if (Array.isArray(parsed.lessonsPlan)) {
      return parsed.lessonsPlan.filter((t): t is string => typeof t === "string");
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Status de chaque titre vis-à-vis du chapitre courant.
 * Utilisé par l'UI pour afficher un badge par ligne.
 */
export interface PlanItemStatus {
  title: string;
  status: "none" | "draft_pending" | "draft_approved" | "published" | "draft_rejected";
  draftId?: string;
  lessonId?: string;
}

export async function loadPlanStatuses(
  chapterId: string,
  titles: string[],
): Promise<PlanItemStatus[]> {
  const chapter = await db.chapter.findUnique({
    where: { id: chapterId },
    include: {
      lessons: { select: { id: true, slug: true, title: true } },
    },
  });
  if (!chapter) return titles.map((t) => ({ title: t, status: "none" as const }));

  const publishedByTitle = new Map<string, string>();
  for (const l of chapter.lessons) publishedByTitle.set(normalize(l.title), l.id);

  const drafts = await db.aIDraft.findMany({
    where: { type: "LESSON" },
    orderBy: { createdAt: "desc" },
    select: { id: true, payload: true, status: true },
  });
  const draftByTitle = new Map<string, { id: string; status: string }>();
  for (const d of drafts) {
    try {
      const parsed = JSON.parse(d.payload) as Partial<LessonDraft>;
      if (parsed.chapterSlug === chapter.slug && typeof parsed.title === "string") {
        const key = normalize(parsed.title);
        // Prend le plus récent seulement.
        if (!draftByTitle.has(key)) draftByTitle.set(key, { id: d.id, status: d.status });
      }
    } catch {
      // ignore
    }
  }

  return titles.map((title) => {
    const norm = normalize(title);
    const published = publishedByTitle.get(norm);
    if (published) return { title, status: "published", lessonId: published };
    const draft = draftByTitle.get(norm);
    if (draft) {
      if (draft.status === "PENDING") return { title, status: "draft_pending", draftId: draft.id };
      if (draft.status === "APPROVED") return { title, status: "draft_approved", draftId: draft.id };
      if (draft.status === "REJECTED") return { title, status: "draft_rejected", draftId: draft.id };
    }
    return { title, status: "none" };
  });
}
