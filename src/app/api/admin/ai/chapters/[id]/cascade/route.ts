/**
 * POST /api/admin/ai/chapters/[id]/cascade — génère en cascade les leçons
 * du plan fourni. Déduplique contre l'existant. Non-bloquant par item.
 *
 * Body :
 *   { titles: string[], audience?, objective?, skipExisting?: boolean }
 */
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { isAIGenerationLive } from "@/lib/ai/anthropic-client";
import { runLessonCascade } from "@/lib/ai/cascade";
import { AICascadePostSchema } from "@/lib/ai/schemas";
import { parseJsonBody } from "@/lib/validation/schemas";

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
  const parsed = await parseJsonBody(req, AICascadePostSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  // Filtrage post-Zod : trim + bornes 4-160 car. Cohérent avec le schéma mais
  // le schéma accepte des strings libres pour laisser passer des espaces en
  // tête/queue avant normalisation ici.
  const titles = body.titles
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && t.length <= 160);
  if (titles.length === 0) {
    return Response.json({ error: "Aucun titre valide (4-160 car.)." }, { status: 400 });
  }
  if (titles.length > 12) {
    return Response.json(
      { error: "Maximum 12 leçons par cascade (sécurité token)." },
      { status: 400 },
    );
  }

  const audience =
    body.audience === "INTERMEDIATE" || body.audience === "ADVANCED"
      ? body.audience
      : "BEGINNER";
  const objective = body.objective && body.objective.length > 0 ? body.objective : undefined;
  const skipExisting = body.skipExisting !== false;

  try {
    const result = await runLessonCascade({
      chapterId: id,
      titles,
      audience,
      objective,
      skipExisting,
    });

    await logAdminAction(guard.user.id, "AI_DRAFT_GENERATE", `cascade:${id}`, {
      mode: "cascade",
      requested: titles.length,
      generated: result.generated,
      skipped: result.skipped,
      errored: result.errored,
    });

    return Response.json({ ok: true, result });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur cascade." },
      { status: 502 },
    );
  }
}
