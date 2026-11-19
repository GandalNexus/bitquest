/**
 * GET /api/admin/content/search — recherche paginée cross-contenu.
 *
 * Query params :
 *   - type  : "course" | "chapter" | "lesson" | "quest" | "challenge" (requis)
 *   - q     : chaîne (max 100 car.) — recherche ILIKE sur title + fields pertinents
 *   - courseSlug  : limite aux chapters du cours (type=chapter)
 *   - chapterSlug : limite aux lessons du chapter (type=lesson)
 *   - limit : 10 par défaut, max 50
 *   - cursor : id à partir duquel paginer (optional — on utilise skip simple pour simplicité)
 *   - page  : page 1-indexée pour alternative à cursor
 *
 * Contrat de réponse :
 *   { items: Array<{ id, title, subtitle?, slug?, code?, parentTitle?, status? }>,
 *     total: number, hasMore: boolean }
 *
 * Note : ILIKE Postgres via Prisma `contains + mode: insensitive`. Pas d'index
 * dédié (ILIKE ≠ full-text) — acceptable jusqu'à ~10K rows. Au-delà, prévoir
 * extension pg_trgm ou passer à Meilisearch/Postgres FTS.
 */
import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";

const ALLOWED = ["course", "chapter", "lesson", "quest", "challenge"] as const;
type ContentType = (typeof ALLOWED)[number];

function isContentType(v: string): v is ContentType {
  return (ALLOWED as readonly string[]).includes(v);
}

export async function GET(req: Request) {
  const guard = await requireRoleAndCsrf(req, "EDITOR");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "";
  if (!isContentType(type)) {
    return Response.json(
      { error: "type requis parmi course|chapter|lesson|quest|challenge" },
      { status: 400 },
    );
  }

  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const limit = clampInt(url.searchParams.get("limit"), 10, 1, 50);
  const page = Math.max(1, clampInt(url.searchParams.get("page"), 1, 1, 1000));
  const skip = (page - 1) * limit;

  const courseSlug = url.searchParams.get("courseSlug")?.trim() ?? null;
  const chapterSlug = url.searchParams.get("chapterSlug")?.trim() ?? null;

  switch (type) {
    case "course":
      return searchCourses(q, limit, skip);
    case "chapter":
      return searchChapters(q, courseSlug, limit, skip);
    case "lesson":
      return searchLessons(q, chapterSlug, courseSlug, limit, skip);
    case "quest":
      return searchQuests(q, limit, skip);
    case "challenge":
      return searchChallenges(q, limit, skip);
  }
}

function clampInt(raw: string | null, def: number, min: number, max: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function likeFilter(q: string): object | undefined {
  if (q.length === 0) return undefined;
  return { contains: q, mode: "insensitive" as const };
}

async function searchCourses(q: string, limit: number, skip: number) {
  const search = likeFilter(q);
  const where = search
    ? {
        OR: [{ title: search }, { subtitle: search }, { slug: search }, { description: search }],
      }
    : undefined;
  const [items, total] = await Promise.all([
    db.course.findMany({
      where,
      orderBy: [{ order: "asc" }, { title: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        publishedAt: true,
        _count: { select: { chapters: true } },
      },
      skip,
      take: limit,
    }),
    db.course.count({ where }),
  ]);
  return Response.json({
    items: items.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      subtitle: c.subtitle,
      status: c.publishedAt ? "PUBLISHED" : "DRAFT",
      meta: `${c._count.chapters} chapitre${c._count.chapters > 1 ? "s" : ""}`,
    })),
    total,
    hasMore: skip + items.length < total,
  });
}

async function searchChapters(
  q: string,
  courseSlug: string | null,
  limit: number,
  skip: number,
) {
  const search = likeFilter(q);
  const where = {
    AND: [
      courseSlug ? { course: { slug: courseSlug } } : {},
      search ? { OR: [{ title: search }, { summary: search }, { slug: search }] } : {},
    ],
  };
  const [items, total] = await Promise.all([
    db.chapter.findMany({
      where,
      orderBy: [{ course: { order: "asc" } }, { order: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        order: true,
        course: { select: { title: true, slug: true } },
        _count: { select: { lessons: true } },
      },
      skip,
      take: limit,
    }),
    db.chapter.count({ where }),
  ]);
  return Response.json({
    items: items.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      subtitle: c.summary,
      parentTitle: c.course.title,
      parentSlug: c.course.slug,
      meta: `${c._count.lessons} leçon${c._count.lessons > 1 ? "s" : ""} · order ${c.order}`,
    })),
    total,
    hasMore: skip + items.length < total,
  });
}

async function searchLessons(
  q: string,
  chapterSlug: string | null,
  courseSlug: string | null,
  limit: number,
  skip: number,
) {
  const search = likeFilter(q);
  const where = {
    AND: [
      chapterSlug ? { chapter: { slug: chapterSlug } } : {},
      courseSlug && !chapterSlug ? { chapter: { course: { slug: courseSlug } } } : {},
      search ? { OR: [{ title: search }, { summary: search }, { slug: search }] } : {},
    ],
  };
  const [items, total] = await Promise.all([
    db.lesson.findMany({
      where,
      orderBy: [{ chapter: { order: "asc" } }, { order: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        order: true,
        publishedAt: true,
        chapter: {
          select: {
            slug: true,
            title: true,
            course: { select: { title: true, slug: true } },
          },
        },
      },
      skip,
      take: limit,
    }),
    db.lesson.count({ where }),
  ]);
  return Response.json({
    items: items.map((l) => ({
      id: l.id,
      slug: l.slug,
      title: l.title,
      subtitle: l.summary,
      parentTitle: `${l.chapter.course.title} / ${l.chapter.title}`,
      status: l.publishedAt ? "PUBLISHED" : "DRAFT",
      meta: `order ${l.order}`,
    })),
    total,
    hasMore: skip + items.length < total,
  });
}

async function searchQuests(q: string, limit: number, skip: number) {
  const search = likeFilter(q);
  const where = search
    ? { OR: [{ title: search }, { code: search }, { subtitle: search }, { description: search }] }
    : undefined;
  const [items, total] = await Promise.all([
    db.quest.findMany({
      where,
      orderBy: [{ track: "asc" }, { order: "asc" }],
      select: {
        id: true,
        code: true,
        title: true,
        subtitle: true,
        track: true,
        missionType: true,
        order: true,
      },
      skip,
      take: limit,
    }),
    db.quest.count({ where }),
  ]);
  return Response.json({
    items: items.map((qu) => ({
      id: qu.id,
      code: qu.code,
      title: qu.title,
      subtitle: qu.subtitle,
      meta: `${qu.track} · ${qu.missionType} · order ${qu.order}`,
    })),
    total,
    hasMore: skip + items.length < total,
  });
}

async function searchChallenges(q: string, limit: number, skip: number) {
  const search = likeFilter(q);
  const where = search ? { OR: [{ title: search }, { prompt: search }, { date: search }] } : undefined;
  const [items, total] = await Promise.all([
    db.dailyChallenge.findMany({
      where,
      orderBy: { date: "desc" },
      select: { id: true, date: true, title: true, prompt: true, xpReward: true, satsReward: true },
      skip,
      take: limit,
    }),
    db.dailyChallenge.count({ where }),
  ]);
  return Response.json({
    items: items.map((c) => ({
      id: c.id,
      title: c.title,
      subtitle: c.prompt.slice(0, 120),
      meta: `${c.date} · ${c.xpReward} XP · ${c.satsReward} sats`,
    })),
    total,
    hasMore: skip + items.length < total,
  });
}
