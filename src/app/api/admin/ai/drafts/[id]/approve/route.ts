/**
 * POST /api/admin/ai/drafts/[id]/approve — publie un brouillon IA en créant
 * la ressource réelle correspondante.
 *
 * Switch par `draft.type` → Quest | Lesson | Chapter | DailyChallenge.
 * L'admin peut surcharger des champs via `overrides` dans le body ; la
 * validation Zod re-tourne sur le payload mergé pour refuser une édition
 * incohérente.
 */
import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import {
  ChallengeDraftSchema,
  ChapterDraftSchema,
  LessonDraftSchema,
  QuestDraftSchema,
  type DraftType,
} from "@/lib/ai/schemas";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "EDITOR");
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as { overrides?: unknown };

  const draft = await db.aIDraft.findUnique({ where: { id } });
  if (!draft) return Response.json({ error: "Draft introuvable." }, { status: 404 });
  if (draft.status !== "PENDING") {
    return Response.json(
      { error: `Draft déjà traité (status=${draft.status}).` },
      { status: 409 },
    );
  }

  const raw = JSON.parse(draft.payload) as Record<string, unknown>;
  const merged =
    typeof body.overrides === "object" && body.overrides !== null
      ? { ...raw, ...(body.overrides as Record<string, unknown>) }
      : raw;

  const type = draft.type as DraftType;
  try {
    const result = await applyDraft(type, merged);

    await db.aIDraft.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedBy: guard.user.id,
        publishedId: result.publishedId,
      },
    });

    await logAdminAction(guard.user.id, "AI_DRAFT_APPROVE", `ai_draft:${id}`, {
      type,
      publishedId: result.publishedId,
    });

    return Response.json({ ok: true, ...result.response }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    const status = /conflit|utilise déjà|existe déjà/i.test(message) ? 409 : 400;
    return Response.json({ error: message }, { status });
  }
}

async function applyDraft(
  type: DraftType,
  merged: Record<string, unknown>,
): Promise<{ publishedId: string; response: Record<string, unknown> }> {
  switch (type) {
    case "QUEST": {
      const data = QuestDraftSchema.parse(merged);
      const existing = await db.quest.findUnique({ where: { code: data.code } });
      if (existing) throw new Error("Une quête utilise déjà ce code.");
      const quest = await db.quest.create({
        data: {
          code: data.code,
          track: data.track,
          order: data.order,
          title: data.title,
          subtitle: data.subtitle,
          description: data.description,
          intro: data.intro,
          theorySections: "[]",
          xpReward: data.xpReward,
          satsReward: data.satsReward,
          requiredLevel: data.requiredLevel,
          missionType: data.missionType,
          missionConfig: JSON.stringify({ brief: "", hint: "" }),
          missionKind: data.missionKind,
        },
      });
      return { publishedId: quest.id, response: { quest } };
    }
    case "LESSON": {
      const data = LessonDraftSchema.parse(merged);
      const chapter = await db.chapter.findFirst({ where: { slug: data.chapterSlug } });
      if (!chapter) throw new Error(`Chapitre introuvable : ${data.chapterSlug}`);
      const existing = await db.lesson.findUnique({
        where: { chapterId_slug: { chapterId: chapter.id, slug: data.slug } },
      });
      if (existing) throw new Error("Une leçon existe déjà avec ce slug dans ce chapitre.");
      const lesson = await db.lesson.create({
        data: {
          chapterId: chapter.id,
          slug: data.slug,
          title: data.title,
          summary: data.summary,
          content: data.content,
          estimatedMinutes: data.estimatedMinutes,
          order: data.order,
        },
      });
      return { publishedId: lesson.id, response: { lesson } };
    }
    case "CHAPTER": {
      const data = ChapterDraftSchema.parse(merged);
      const course = await db.course.findFirst({ where: { slug: data.courseSlug } });
      if (!course) throw new Error(`Cours introuvable : ${data.courseSlug}`);
      const existing = await db.chapter.findUnique({
        where: { courseId_slug: { courseId: course.id, slug: data.slug } },
      });
      if (existing) throw new Error("Un chapitre existe déjà avec ce slug dans ce cours.");
      const chapter = await db.chapter.create({
        data: {
          courseId: course.id,
          slug: data.slug,
          title: data.title,
          summary: data.summary,
          order: data.order,
        },
      });
      return { publishedId: chapter.id, response: { chapter } };
    }
    case "CHALLENGE": {
      const data = ChallengeDraftSchema.parse(merged);
      const existing = await db.dailyChallenge.findUnique({ where: { date: data.date } });
      if (existing) throw new Error(`Un défi existe déjà pour le ${data.date}.`);
      const challenge = await db.dailyChallenge.create({
        data: {
          date: data.date,
          title: data.title,
          prompt: data.prompt,
          xpReward: data.xpReward,
          satsReward: data.satsReward,
        },
      });
      return { publishedId: challenge.id, response: { challenge } };
    }
  }
}
