/**
 * POST /api/admin/ai/generate/[type] — génération IA guidée par brief.
 *
 * Body attendu : partial `GenerationBrief` (le champ `type` est tiré de l'URL
 * pour URL-propre). Validation Zod du brief, chargement taxonomie, génération
 * via Claude, vérif conformity, persistance.
 */
import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { isAIGenerationLive } from "@/lib/ai/anthropic-client";
import { generateDraft } from "@/lib/ai/generate";
import { loadTaxonomy } from "@/lib/ai/context";
import { checkConformity } from "@/lib/ai/validate";
import { GenerationBriefSchema, isDraftType, type DraftType } from "@/lib/ai/schemas";

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
    return Response.json({ error: `Type inconnu : ${rawType}` }, { status: 400 });
  }
  const type = normalized as DraftType;

  const rawBody = await req.json().catch(() => ({}));
  const parsed = GenerationBriefSchema.safeParse({ ...rawBody, type });
  if (!parsed.success) {
    return Response.json(
      { error: "Brief invalide.", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const brief = parsed.data;

  const taxonomy = await loadTaxonomy(type);

  let result;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result = await generateDraft({ type, brief, taxonomy: taxonomy as any });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur IA inconnue." },
      { status: 502 },
    );
  }

  // Vérif conformity — erreurs bloquantes rejetées, warnings persistés.
  const issues = checkConformity(type, result.draft);
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) {
    return Response.json(
      {
        error: "Brouillon non conforme — intervention requise.",
        issues,
      },
      { status: 422 },
    );
  }
  const warnings = issues.filter((i) => i.severity === "warning");

  const draft = await db.aIDraft.create({
    data: {
      type,
      payload: JSON.stringify(result.draft),
      aiModel: result.model,
      tokensInput: result.usage.input + result.usage.cacheRead + result.usage.cacheCreated,
      tokensOutput: result.usage.output,
      // On persiste les warnings dans rejectReason pour que l'UI les voie.
      rejectReason: warnings.length > 0 ? warnings.map((w) => `⚠ ${w.message}`).join(" | ") : null,
    },
  });

  await logAdminAction(guard.user.id, "AI_DRAFT_GENERATE", `ai_draft:${draft.id}`, {
    type,
    mode: brief.mode,
    courseSlug: brief.courseSlug ?? null,
    tokensOutput: result.usage.output,
    warnings: warnings.length,
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
        warnings,
      },
    },
    { status: 201 },
  );
}
