/**
 * POST /api/admin/ai/generate/[type] — route générique pour les 4 types.
 * Route-param `type` ∈ { quest, lesson, chapter, challenge } (case-insensitive).
 */
import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { isAIGenerationLive } from "@/lib/ai/anthropic-client";
import { generateDraft } from "@/lib/ai/generate";
import { loadGenerationContext } from "@/lib/ai/context";
import { isDraftType, type DraftType } from "@/lib/ai/schemas";

export async function POST(
  req: Request,
  context: { params: Promise<{ type: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "EDITOR");
  if (!guard.ok) return guard.response;

  if (!isAIGenerationLive()) {
    return Response.json(
      { error: "Génération IA désactivée. Configure AI_GENERATION_ENABLED=1 et ANTHROPIC_API_KEY." },
      { status: 503 },
    );
  }

  const { type: rawType } = await context.params;
  const normalized = rawType.toUpperCase();
  if (!isDraftType(normalized)) {
    return Response.json(
      { error: `Type inconnu : ${rawType}. Attendu : quest | lesson | chapter | challenge.` },
      { status: 400 },
    );
  }
  const type = normalized as DraftType;

  const body = (await req.json().catch(() => ({}))) as { hint?: unknown };
  const hint =
    typeof body.hint === "string" && body.hint.trim().length > 0 && body.hint.length <= 500
      ? body.hint.trim()
      : undefined;

  const ctx = await loadGenerationContext(type);
  let result;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result = await generateDraft({ type, context: ctx as any, hint });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur IA inconnue." },
      { status: 502 },
    );
  }

  const draft = await db.aIDraft.create({
    data: {
      type,
      payload: JSON.stringify(result.draft),
      aiModel: result.model,
      tokensInput: result.usage.input + result.usage.cacheRead + result.usage.cacheCreated,
      tokensOutput: result.usage.output,
    },
  });

  await logAdminAction(guard.user.id, "AI_DRAFT_GENERATE", `ai_draft:${draft.id}`, {
    type,
    model: result.model,
    tokensOutput: result.usage.output,
    cacheReadTokens: result.usage.cacheRead,
  });

  return Response.json(
    {
      ok: true,
      draft: {
        id: draft.id,
        type: draft.type,
        status: draft.status,
        payload: result.draft,
        createdAt: draft.createdAt,
        usage: result.usage,
      },
    },
    { status: 201 },
  );
}
