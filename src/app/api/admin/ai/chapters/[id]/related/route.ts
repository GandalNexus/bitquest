/**
 * POST /api/admin/ai/chapters/[id]/related — génère un contenu annexe lié
 * au chapitre (quête, défi quotidien). Contexte du chapitre injecté dans le
 * brief automatiquement.
 *
 * Body : { kind: "QUEST" | "CHALLENGE", subject?: string, audience?, challengeFormat? }
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
  const chapter = await db.chapter.findUnique({
    where: { id },
    include: { course: { select: { slug: true, title: true } } },
  });
  if (!chapter) return Response.json({ error: "Chapitre introuvable." }, { status: 404 });

  const parsed = await parseJsonBody(req, AIRelatedPostSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const kind: Kind = body.kind;

  const subject =
    body.subject && body.subject.length >= 5
      ? body.subject
      : `${kind === "QUEST" ? "Quête" : "Défi quotidien"} lié au chapitre « ${chapter.title} » (${chapter.summary.slice(0, 120)})`;

  const audience =
    body.audience === "INTERMEDIATE" || body.audience === "ADVANCED"
      ? body.audience
      : "BEGINNER";

  const briefInput = {
    type: kind,
    mode: "ENRICH" as const,
    subject,
    audience,
    objective: `Renforcer les acquis du chapitre « ${chapter.title} » via un format ${kind === "QUEST" ? "mission pratique" : "défi court"}.`,
    concepts: [],
    courseSlug: chapter.course.slug,
    chapterSlug: chapter.slug,
    challengeFormat: kind === "CHALLENGE" ? body.challengeFormat : undefined,
  };

  const briefParse = GenerationBriefSchema.safeParse(briefInput);
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
    return Response.json(
      { error: "Non conforme.", issues },
      { status: 422 },
    );
  }
  const warnings = issues.filter((i) => i.severity === "warning");

  // Injection de meta pour que l'approve crée automatiquement la liaison
  // ChapterQuest (QUEST uniquement — les CHALLENGE ne sont pas rattachées).
  // `_bitquestMeta` est strip-é côté approve avant la validation Zod.
  const payloadWithMeta =
    kind === "QUEST"
      ? { ...result.draft, _bitquestMeta: { linkChapterId: chapter.id } }
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

  await logAdminAction(guard.user.id, "AI_DRAFT_GENERATE", `related:${chapter.id}`, {
    kind,
    chapterSlug: chapter.slug,
    courseSlug: chapter.course.slug,
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
