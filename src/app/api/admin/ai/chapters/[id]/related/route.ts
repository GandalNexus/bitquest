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
import { GenerationBriefSchema } from "@/lib/ai/schemas";

const ALLOWED_KINDS = ["QUEST", "CHALLENGE"] as const;
type Kind = (typeof ALLOWED_KINDS)[number];

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

  const body = (await req.json().catch(() => ({}))) as {
    kind?: unknown;
    subject?: unknown;
    audience?: unknown;
    challengeFormat?: unknown;
  };

  if (typeof body.kind !== "string" || !(ALLOWED_KINDS as readonly string[]).includes(body.kind)) {
    return Response.json({ error: "kind doit être QUEST ou CHALLENGE." }, { status: 400 });
  }
  const kind = body.kind as Kind;

  const subject =
    typeof body.subject === "string" && body.subject.trim().length >= 5
      ? body.subject.trim()
      : `${kind === "QUEST" ? "Quête" : "Défi quotidien"} lié au chapitre « ${chapter.title} » (${chapter.summary.slice(0, 120)})`;

  const audience =
    body.audience === "INTERMEDIATE" || body.audience === "ADVANCED"
      ? (body.audience as "INTERMEDIATE" | "ADVANCED")
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
    challengeFormat:
      kind === "CHALLENGE" &&
      typeof body.challengeFormat === "string" &&
      ["QUESTION", "QUIZ", "MINI_TASK", "OBSERVATION"].includes(body.challengeFormat)
        ? (body.challengeFormat as "QUESTION" | "QUIZ" | "MINI_TASK" | "OBSERVATION")
        : undefined,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const draft = await db.aIDraft.create({
    data: {
      type: kind,
      payload: JSON.stringify(result.draft),
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
