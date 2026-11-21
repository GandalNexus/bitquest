/**
 * POST /api/admin/ai/drafts/[id]/approve — publie un brouillon IA v2.
 *
 * Mapping riche → DB :
 *   - QUEST : scenario+description → subtitle+description. objectives+steps+successCriteria
 *     → theorySections. mission+steps → missionConfig (brief/hint).
 *   - LESSON : intro+objectives+sections+keypoints+conclusion rendus en MDX
 *     stocké dans Lesson.content. questions → ignore (hors scope DB V1).
 *   - CHAPTER : objective ignoré (pas de colonne), lessonsPlan stocké dans
 *     summary (suffixe).
 *   - CHALLENGE : format+difficulty+expectedAnswer intégrés dans prompt.
 */
import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import {
  AIDraftApproveSchema,
  ChallengeDraftSchema,
  ChapterDraftSchema,
  LessonDraftSchema,
  QuestDraftSchema,
  type DraftType,
} from "@/lib/ai/schemas";
import { parseJsonBody } from "@/lib/validation/schemas";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "EDITOR");
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const parsed = await parseJsonBody(req, AIDraftApproveSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const draft = await db.aIDraft.findUnique({ where: { id } });
  if (!draft) return Response.json({ error: "Draft introuvable." }, { status: 404 });
  if (draft.status !== "PENDING") {
    return Response.json(
      { error: `Draft déjà traité (status=${draft.status}).` },
      { status: 409 },
    );
  }

  const raw = JSON.parse(draft.payload) as Record<string, unknown>;
  const merged = body.overrides ? { ...raw, ...body.overrides } : raw;

  // Extrait la meta BitQuest (injectée par certains endpoints — ex: related
  // depuis une page chapitre pour auto-link). Pop AVANT Zod car Zod en strict
  // mode strip les champs inconnus mais on garde l'info côté serveur ici.
  const meta = extractMeta(merged);
  delete merged._bitquestMeta;

  const type = draft.type as DraftType;
  try {
    const result = await applyDraft(type, merged);

    // Auto-link QUEST → chapter si meta fournie.
    const linked: { chapterId: string; order: number } | null =
      type === "QUEST" && meta?.linkChapterId
        ? await linkQuestToChapter(result.publishedId, meta.linkChapterId)
        : null;

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
      linkedChapterId: linked?.chapterId ?? null,
    });

    return Response.json(
      { ok: true, ...result.response, linked },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    const status = /conflit|utilise déjà|existe déjà|introuvable/i.test(message) ? 409 : 400;
    return Response.json({ error: message }, { status });
  }
}

interface BitquestMeta {
  linkChapterId?: string;
}

/** Extrait et supprime `_bitquestMeta` du payload. Null si absent/invalide. */
function extractMeta(obj: Record<string, unknown>): BitquestMeta | null {
  const m = obj._bitquestMeta;
  if (typeof m !== "object" || m === null) return null;
  const linkChapterId = (m as { linkChapterId?: unknown }).linkChapterId;
  if (typeof linkChapterId === "string" && linkChapterId.length >= 20) {
    return { linkChapterId };
  }
  return null;
}

/**
 * Lie une quête à un chapitre via ChapterQuest. Idempotent : si la relation
 * existe déjà (PK composite), retourne la ligne existante. Order auto = max+1.
 */
async function linkQuestToChapter(
  questId: string,
  chapterId: string,
): Promise<{ chapterId: string; order: number }> {
  const chapter = await db.chapter.findUnique({
    where: { id: chapterId },
    select: { id: true },
  });
  if (!chapter) {
    // Chapitre a pu être supprimé entre génération et approve — pas bloquant.
    return { chapterId, order: -1 };
  }

  const existing = await db.chapterQuest.findUnique({
    where: { chapterId_questId: { chapterId, questId } },
  });
  if (existing) return { chapterId, order: existing.order };

  const last = await db.chapterQuest.findFirst({
    where: { chapterId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const order = (last?.order ?? -1) + 1;

  await db.chapterQuest.create({
    data: { chapterId, questId, order },
  });
  return { chapterId, order };
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

      // Mapping rich → DB.
      // theorySections : 1 section "Contexte" (scenario+objectives) + 1 section
      // "Étapes" (steps+successCriteria) + intro détaillée.
      const theorySections = [
        {
          title: "Contexte",
          body: data.scenario,
          keypoints: data.objectives,
        },
        {
          title: "Déroulé",
          body: data.steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
          keypoints: data.successCriteria,
        },
      ];
      const missionConfig = {
        brief: data.mission,
        hint: data.steps[0] ?? "",
        successCriteria: data.successCriteria,
      };

      const quest = await db.quest.create({
        data: {
          code: data.code,
          track: data.track,
          order: data.order,
          title: data.title,
          subtitle: data.subtitle,
          description: data.description,
          intro: data.intro,
          theorySections: JSON.stringify(theorySections),
          xpReward: data.xpReward,
          satsReward: data.satsReward,
          requiredLevel: data.requiredLevel,
          missionType: data.missionType,
          missionConfig: JSON.stringify(missionConfig),
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

      // Mapping rich → MDX dans Lesson.content.
      const mdx = renderLessonToMDX(data);

      const lesson = await db.lesson.create({
        data: {
          chapterId: chapter.id,
          slug: data.slug,
          title: data.title,
          summary: data.summary,
          content: mdx,
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

      // Mapping : objective + plan intégrés dans summary (séparateur \n\n).
      const summary = [
        data.summary,
        "",
        `**Objectif :** ${data.objective}`,
        "",
        "**Plan de leçons :**",
        ...data.lessonsPlan.map((l, i) => `${i + 1}. ${l}`),
      ].join("\n");

      const chapter = await db.chapter.create({
        data: {
          courseId: course.id,
          slug: data.slug,
          title: data.title,
          summary,
          order: data.order,
        },
      });
      return { publishedId: chapter.id, response: { chapter } };
    }

    case "CHALLENGE": {
      const data = ChallengeDraftSchema.parse(merged);
      const existing = await db.dailyChallenge.findUnique({ where: { date: data.date } });
      if (existing) throw new Error(`Un défi existe déjà pour le ${data.date}.`);

      // Prompt enrichi avec format + difficulté. expectedAnswer gardé hors DB
      // (visible uniquement côté admin review via AIDraft.payload).
      const prompt = [
        `**[${data.format}]** ${data.prompt}`,
        "",
        `_Difficulté : ${data.difficulty}_`,
      ].join("\n");

      const challenge = await db.dailyChallenge.create({
        data: {
          date: data.date,
          title: data.title,
          prompt,
          xpReward: data.xpReward,
          satsReward: data.satsReward,
        },
      });
      return { publishedId: challenge.id, response: { challenge } };
    }
  }
}

/** Rend un LessonDraft riche en MDX stable (ordre fixe des sections). */
function renderLessonToMDX(l: ReturnType<typeof LessonDraftSchema.parse>): string {
  const parts: string[] = [];
  parts.push(l.intro);
  parts.push("");
  parts.push("## Objectifs d'apprentissage");
  for (const o of l.objectives) parts.push(`- ${o}`);
  parts.push("");
  for (const section of l.sections) {
    parts.push(`## ${section.heading}`);
    parts.push("");
    parts.push(section.body);
    if (section.example) {
      parts.push("");
      parts.push(`> **Exemple :** ${section.example}`);
    }
    parts.push("");
  }
  parts.push("## À retenir");
  for (const k of l.keypoints) parts.push(`- ${k}`);
  parts.push("");
  parts.push("## Conclusion");
  parts.push(l.conclusion);
  if (l.comprehensionQuestions && l.comprehensionQuestions.length > 0) {
    parts.push("");
    parts.push("## Questions de compréhension");
    for (const q of l.comprehensionQuestions) {
      parts.push(`**Q :** ${q.question}`);
      parts.push(`**R :** ${q.answer}`);
      parts.push("");
    }
  }
  return parts.join("\n");
}
