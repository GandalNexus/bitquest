/**
 * POST /api/admin/ai/lessons/[id]/related — génère un contenu annexe lié
 * à une leçon (quête pratique ou défi quotidien). Le contexte complet de la
 * leçon (titre + résumé + contenu + chapitre + cours) est injecté dans le
 * brief pour que l'IA produise un contenu cohérent avec le concept enseigné.
 *
 * Body : { kind: "QUEST" | "CHALLENGE", subject?: string, audience?, challengeFormat? }
 *
 * Auto-link : si kind=QUEST, injecte `_bitquestMeta.linkChapterId` dans le
 * payload → l'approve endpoint créera la relation ChapterQuest (le chapitre
 * est celui de la leçon).
 */
import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { isAIGenerationLive } from "@/lib/ai/anthropic-client";
import { generateDraft } from "@/lib/ai/generate";
import { loadTaxonomy } from "@/lib/ai/context";
import { checkConformity } from "@/lib/ai/validate";
import { AIRelatedPostSchema, GenerationBriefSchema } from "@/lib/ai/schemas";
import { parseJsonBody } from "@/lib/validation/schemas";

type Kind = "QUEST" | "CHALLENGE";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "EDITOR");
  if (!guard.ok) return guard.response;

  if (!isAIGenerationLive()) {
    return Response.json(
      { error: "Génération IA désactivée (AI_GENERATION_ENABLED=0)." },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  const lesson = await db.lesson.findUnique({
    where: { id },
    include: {
      chapter: {
        include: { course: { select: { slug: true, title: true } } },
      },
    },
  });
  if (!lesson) return Response.json({ error: "Leçon introuvable." }, { status: 404 });

  const parsed = await parseJsonBody(req, AIRelatedPostSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const kind: Kind = body.kind;

  // Troncation du contenu pour tenir dans le brief.
  const lessonExcerpt =
    lesson.content.length > 800 ? lesson.content.slice(0, 800) + "…" : lesson.content;

  const defaultSubject =
    kind === "QUEST"
      ? `Mettre en pratique le concept enseigné dans « ${lesson.title} » via une mission BitLab concrète`
      : `Défi quotidien court basé sur le concept clé de « ${lesson.title} »`;

  const subject = body.subject && body.subject.length >= 5 ? body.subject : defaultSubject;

  const audience =
    body.audience === "INTERMEDIATE" || body.audience === "ADVANCED"
      ? body.audience
      : "BEGINNER";

  const objective = `Renforcer l'acquis de la leçon « ${lesson.title} » (chapitre : ${lesson.chapter.title}, cours : ${lesson.chapter.course.title}).

Résumé de la leçon :
${lesson.summary}

Extrait du contenu :
${lessonExcerpt}`;

  const briefParse = GenerationBriefSchema.safeParse({
    type: kind,
    mode: "ENRICH",
    subject,
    audience,
    objective,
    concepts: [],
    courseSlug: lesson.chapter.course.slug,
    chapterSlug: lesson.chapter.slug,
    challengeFormat: kind === "CHALLENGE" ? body.challengeFormat : undefined,
  });
  if (!briefParse.success) {
    return Response.json(
      { error: "Brief invalide.", issues: briefParse.error.issues },
      { status: 400 },
    );
  }

  const taxonomy = await loadTaxonomy(kind);
  let result;
  try {
    result = await generateDraft({ type: kind, brief: briefParse.data, taxonomy: taxonomy as any });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur IA." },
      { status: 502 },
    );
  }

  const issues = checkConformity(kind, result.draft);
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) {
    return Response.json({ error: "Non conforme.", issues }, { status: 422 });
  }
  const warnings = issues.filter((i) => i.severity === "warning");

  // Auto-link QUEST → chapter de la leçon (même pattern que chapter/related).
  const payloadWithMeta =
    kind === "QUEST"
      ? { ...result.draft, _bitquestMeta: { linkChapterId: lesson.chapter.id } }
      : result.draft;

  const draft = await db.aIDraft.create({
    data: {
      type: kind,
      payload: JSON.stringify(payloadWithMeta),
      aiModel: result.model,
      tokensInput: result.usage.input + result.usage.cacheRead + result.usage.cacheCreated,
      tokensOutput: result.usage.output,
      rejectReason:
        warnings.length > 0 ? warnings.map((w) => `⚠ ${w.message}`).join(" | ") : null,
    },
  });

  await logAdminAction(guard.user.id, "AI_DRAFT_GENERATE", `related-lesson:${lesson.id}`, {
    kind,
    lessonId: lesson.id,
    chapterSlug: lesson.chapter.slug,
    tokensOutput: result.usage.output,
  });

  return Response.json(
    {
      ok: true,
      draft: {
        id: draft.id,
        type: draft.type,
        payload: result.draft,
        warnings,
      },
    },
    { status: 201 },
  );
}
