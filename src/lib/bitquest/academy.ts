import { db } from "@/lib/db";

/* ============ Types publics Académie ============ */

export interface AcademyCourseSummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  coverIcon: string;
  order: number;
  totalLessons: number;
  totalChapters: number;
  completedLessons: number;
  pct: number;
}

export interface AcademyLessonNode {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  estimatedMinutes: number;
  order: number;
  completed: boolean;
}

export interface AcademyChapterPrerequisite {
  questCode: string;
  questTitle: string;
  completed: boolean;
}

export interface AcademyChapterNode {
  id: string;
  slug: string;
  title: string;
  summary: string;
  order: number;
  lessons: AcademyLessonNode[];
  /**
   * `true` si le chapitre est pédagogiquement verrouillé : il existe au
   * moins un ChapterQuest lié dont la quête n'est pas COMPLETED pour
   * l'utilisateur authentifié. Les users anonymes voient tout déverrouillé
   * (preview). Ce gate est UX-only, le contenu reste accessible par URL
   * directe — à sens pédagogique, pas sécuritaire.
   */
  locked: boolean;
  prerequisites: AcademyChapterPrerequisite[];
}

export interface AcademyCourseTree {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  coverIcon: string;
  totalLessons: number;
  completedLessons: number;
  pct: number;
  chapters: AcademyChapterNode[];
}

export interface AcademyLessonView {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  estimatedMinutes: number;
  order: number;
  chapter: { id: string; slug: string; title: string; order: number };
  course: { id: string; slug: string; title: string };
  completed: boolean;
  completedAt: string | null;
  prev: { courseSlug: string; lessonSlug: string; title: string } | null;
  next: { courseSlug: string; lessonSlug: string; title: string } | null;
  courseProgress: { completed: number; total: number; pct: number };
}

/* ============ Fonctions pures (testables sans DB) ============ */

/** Pourcentage arrondi (0-100) de progression d'un cours. */
export function computeCoursePct(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
}

/** Aplatit l'ordre canonique des leçons d'un cours : par chapter.order puis lesson.order. */
export function flattenLessons<
  C extends { order: number; lessons: L[] },
  L extends { id: string; slug: string; order: number; title: string },
>(chapters: C[]): { id: string; slug: string; title: string; chapterIndex: number; lessonIndex: number }[] {
  const out: { id: string; slug: string; title: string; chapterIndex: number; lessonIndex: number }[] = [];
  const sortedChapters = [...chapters].sort((a, b) => a.order - b.order);
  for (const [chapterIndex, ch] of sortedChapters.entries()) {
    const sortedLessons = [...ch.lessons].sort((a, b) => a.order - b.order);
    for (const [lessonIndex, l] of sortedLessons.entries()) {
      out.push({ id: l.id, slug: l.slug, title: l.title, chapterIndex, lessonIndex });
    }
  }
  return out;
}

/** Retourne la leçon précédente / suivante dans le cours selon la liste aplatie. */
export function pickNeighbors<T extends { id: string }>(
  flat: T[],
  currentId: string,
): { prev: T | null; next: T | null } {
  const i = flat.findIndex((l) => l.id === currentId);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i > 0 ? flat[i - 1] : null,
    next: i < flat.length - 1 ? flat[i + 1] : null,
  };
}

/**
 * Calcule l'état de verrouillage d'un chapitre à partir de ses quêtes
 * prérequises et des codes de quêtes COMPLETED pour l'utilisateur.
 * Fonction pure (sans I/O) — exposée pour test unitaire.
 *
 * - Anonymes (userId null côté caller → `completedQuestCodes.size === 0`
 *   combiné avec `anonymous=true`) : `locked=false` (preview).
 * - Authentifiés sans aucun prérequis : `locked=false`.
 * - Authentifiés avec au moins 1 prérequis non COMPLETED : `locked=true`.
 */
export function computeChapterLock(
  linkedQuests: { quest: { code: string; title: string } }[],
  completedQuestCodes: Set<string>,
  anonymous: boolean,
): {
  locked: boolean;
  prerequisites: { questCode: string; questTitle: string; completed: boolean }[];
} {
  const prerequisites = linkedQuests.map((cq) => ({
    questCode: cq.quest.code,
    questTitle: cq.quest.title,
    completed: completedQuestCodes.has(cq.quest.code),
  }));
  const locked = !anonymous && prerequisites.some((p) => !p.completed);
  return { locked, prerequisites };
}

/** Sélectionne la prochaine leçon non complétée (ou la première s'il y en a aucune). */
export function selectNextLesson<T extends { id: string }>(
  flat: T[],
  completedIds: Set<string>,
): T | null {
  if (flat.length === 0) return null;
  const nextNotDone = flat.find((l) => !completedIds.has(l.id));
  return nextNotDone ?? null;
}

/* ============ Fonctions I/O (Prisma) ============ */

/** Catalogue des cours publiés avec compteurs et progression de l'utilisateur. */
export async function getCoursesSummary(userId: string | null): Promise<AcademyCourseSummary[]> {
  const courses = await db.course.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { order: "asc" },
    include: {
      chapters: {
        include: {
          lessons: {
            where: { publishedAt: { not: null } },
            select: { id: true },
          },
        },
      },
    },
  });

  const allLessonIds = courses.flatMap((c) => c.chapters.flatMap((ch) => ch.lessons.map((l) => l.id)));
  const progressRows = userId && allLessonIds.length > 0
    ? await db.lessonProgress.findMany({
        where: { userId, lessonId: { in: allLessonIds } },
        select: { lessonId: true },
      })
    : [];
  const completedIds = new Set(progressRows.map((p) => p.lessonId));

  return courses.map((course) => {
    const chapters = course.chapters;
    const totalLessons = chapters.reduce((acc, ch) => acc + ch.lessons.length, 0);
    const completed = chapters.reduce(
      (acc, ch) => acc + ch.lessons.filter((l) => completedIds.has(l.id)).length,
      0,
    );
    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      subtitle: course.subtitle,
      description: course.description,
      coverIcon: course.coverIcon,
      order: course.order,
      totalChapters: chapters.length,
      totalLessons,
      completedLessons: completed,
      pct: computeCoursePct(completed, totalLessons),
    };
  });
}

/** Arbre complet (chapitres + leçons) d'un cours, avec marqueurs de complétion. */
export async function getCourseTree(
  courseSlug: string,
  userId: string | null,
): Promise<AcademyCourseTree | null> {
  const course = await db.course.findUnique({
    where: { slug: courseSlug },
    include: {
      chapters: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            where: { publishedAt: { not: null } },
            orderBy: { order: "asc" },
          },
          linkedQuests: {
            orderBy: { order: "asc" },
            include: { quest: { select: { code: true, title: true } } },
          },
        },
      },
    },
  });
  if (!course || !course.publishedAt) return null;

  const lessonIds = course.chapters.flatMap((ch) => ch.lessons.map((l) => l.id));
  const progressRows = userId && lessonIds.length > 0
    ? await db.lessonProgress.findMany({
        where: { userId, lessonId: { in: lessonIds } },
        select: { lessonId: true },
      })
    : [];
  const completedIds = new Set(progressRows.map((p) => p.lessonId));

  // Collecte des quêtes prérequises distinctes puis fetch unique de leur
  // statut COMPLETED pour l'utilisateur — évite N+1 par chapitre.
  const prereqQuestCodes = Array.from(
    new Set(
      course.chapters.flatMap((ch) =>
        ch.linkedQuests.map((cq) => cq.quest.code),
      ),
    ),
  );
  const completedQuestCodes = userId && prereqQuestCodes.length > 0
    ? new Set(
        (
          await db.userQuestProgress.findMany({
            where: {
              userId,
              status: "COMPLETED",
              quest: { code: { in: prereqQuestCodes } },
            },
            select: { quest: { select: { code: true } } },
          })
        ).map((p) => p.quest.code),
      )
    : new Set<string>();

  const chapters: AcademyChapterNode[] = course.chapters.map((ch) => {
    const { locked, prerequisites } = computeChapterLock(
      ch.linkedQuests,
      completedQuestCodes,
      userId === null,
    );
    return {
      id: ch.id,
      slug: ch.slug,
      title: ch.title,
      summary: ch.summary,
      order: ch.order,
      locked,
      prerequisites,
      lessons: ch.lessons.map((l) => ({
        id: l.id,
        slug: l.slug,
        title: l.title,
        summary: l.summary,
        content: l.content,
        estimatedMinutes: l.estimatedMinutes,
        order: l.order,
        completed: completedIds.has(l.id),
      })),
    };
  });

  const totalLessons = lessonIds.length;
  const completedLessons = completedIds.size;

  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    subtitle: course.subtitle,
    description: course.description,
    coverIcon: course.coverIcon,
    totalLessons,
    completedLessons,
    pct: computeCoursePct(completedLessons, totalLessons),
    chapters,
  };
}

/** Détail d'une leçon publiée, avec voisins + marqueur de complétion pour l'utilisateur. */
export async function getLessonView(
  courseSlug: string,
  lessonSlug: string,
  userId: string | null,
): Promise<AcademyLessonView | null> {
  const course = await db.course.findUnique({
    where: { slug: courseSlug },
    include: {
      chapters: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            where: { publishedAt: { not: null } },
            orderBy: { order: "asc" },
          },
        },
      },
    },
  });
  if (!course || !course.publishedAt) return null;

  const flat = course.chapters.flatMap((ch) =>
    ch.lessons.map((l) => ({
      id: l.id,
      slug: l.slug,
      title: l.title,
      courseSlug: course.slug,
      chapter: ch,
      lesson: l,
    })),
  );

  const idx = flat.findIndex((f) => f.slug === lessonSlug);
  if (idx === -1) return null;
  const current = flat[idx];

  const lessonIds = flat.map((f) => f.id);
  const progressRows = userId && lessonIds.length > 0
    ? await db.lessonProgress.findMany({
        where: { userId, lessonId: { in: lessonIds } },
        select: { lessonId: true, completedAt: true },
      })
    : [];
  const progressByLesson = new Map(progressRows.map((p) => [p.lessonId, p.completedAt]));
  const completedIds = new Set(progressByLesson.keys());
  const currentCompletedAt = progressByLesson.get(current.id) ?? null;

  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx < flat.length - 1 ? flat[idx + 1] : null;

  return {
    id: current.lesson.id,
    slug: current.lesson.slug,
    title: current.lesson.title,
    summary: current.lesson.summary,
    content: current.lesson.content,
    estimatedMinutes: current.lesson.estimatedMinutes,
    order: current.lesson.order,
    chapter: {
      id: current.chapter.id,
      slug: current.chapter.slug,
      title: current.chapter.title,
      order: current.chapter.order,
    },
    course: { id: course.id, slug: course.slug, title: course.title },
    completed: completedIds.has(current.id),
    completedAt: currentCompletedAt ? currentCompletedAt.toISOString() : null,
    prev: prev
      ? { courseSlug: course.slug, lessonSlug: prev.slug, title: prev.title }
      : null,
    next: next
      ? { courseSlug: course.slug, lessonSlug: next.slug, title: next.title }
      : null,
    courseProgress: {
      completed: completedIds.size,
      total: flat.length,
      pct: computeCoursePct(completedIds.size, flat.length),
    },
  };
}

/** Marque une leçon comme terminée (idempotent : réécrit completedAt si déjà présent). */
export async function completeLesson(userId: string, lessonId: string) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, title: true, publishedAt: true, chapter: { select: { course: { select: { slug: true, title: true } } } } },
  });
  if (!lesson || !lesson.publishedAt) {
    return { ok: false as const, reason: "LESSON_NOT_FOUND" as const };
  }

  const existing = await db.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });

  if (existing) {
    return { ok: true as const, alreadyCompleted: true, completedAt: existing.completedAt.toISOString() };
  }

  const created = await db.lessonProgress.create({
    data: { userId, lessonId },
  });

  await db.userEvent.create({
    data: {
      userId,
      type: "LESSON_COMPLETED",
      payload: JSON.stringify({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        courseSlug: lesson.chapter.course.slug,
        courseTitle: lesson.chapter.course.title,
      }),
    },
  });

  return { ok: true as const, alreadyCompleted: false, completedAt: created.completedAt.toISOString() };
}
