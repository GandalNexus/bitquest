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
  const body = (await req.json().catch(() => ({}))) as {
    titles?: unknown;
    audience?: unknown;
    objective?: unknown;
    skipExisting?: unknown;
  };

  if (!Array.isArray(body.titles)) {
    return Response.json({ error: "Champ `titles` requis (array)." }, { status: 400 });
  }
  const titles = body.titles
    .filter((t): t is string => typeof t === "string")
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
      ? (body.audience as "INTERMEDIATE" | "ADVANCED")
      : "BEGINNER";
  const objective =
    typeof body.objective === "string" && body.objective.trim().length > 0
      ? body.objective.trim()
      : undefined;
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
