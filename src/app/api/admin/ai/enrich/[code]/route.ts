/**
 * POST /api/admin/ai/enrich/[code] — génère un enrichissement (theory + quiz)
 * pour la quête ciblée et l'applique directement :
 *   - `quest.theorySections` ← JSON.stringify(sections)
 *   - crée `QuizQuestion` rows (après avoir supprimé les anciennes)
 *
 * Endpoint "one-shot" : pas de review drafts (contrairement aux générations
 * de nouvelles ressources). L'admin voit le résultat final dans l'UI éditeur.
 * Pour tracer l'opération on logge via `logAdminAction` et on persiste une
 * entrée `AIDraft` type `QUEST_ENRICHMENT` status=APPROVED (traçabilité +
 * compteur dans le dashboard usage).
 */
import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { isAIGenerationLive } from "@/lib/ai/anthropic-client";
import { generateQuestEnrichment } from "@/lib/ai/generate-enrichment";

export async function POST(
  req: Request,
  context: { params: Promise<{ code: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "EDITOR");
  if (!guard.ok) return guard.response;

  if (!isAIGenerationLive()) {
    return Response.json(
      { error: "Génération IA désactivée (AI_GENERATION_ENABLED=0)." },
      { status: 503 },
    );
  }

  const { code } = await context.params;
  const quest = await db.quest.findUnique({ where: { code } });
  if (!quest) return Response.json({ error: "Quête introuvable." }, { status: 404 });

  let result;
  try {
    result = await generateQuestEnrichment({
      quest: {
        code: quest.code,
        track: quest.track,
        title: quest.title,
        subtitle: quest.subtitle,
        description: quest.description,
        intro: quest.intro,
        missionType: quest.missionType,
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur IA inconnue." },
      { status: 502 },
    );
  }

  // Application atomique : theory + quiz dans une transaction.
  await db.$transaction(async (tx) => {
    await tx.quest.update({
      where: { id: quest.id },
      data: { theorySections: JSON.stringify(result.payload.theorySections) },
    });
    await tx.quizQuestion.deleteMany({ where: { questId: quest.id } });
    await tx.quizQuestion.createMany({
      data: result.payload.quizQuestions.map((q, idx) => ({
        questId: quest.id,
        order: idx,
        type: q.type,
        question: q.question,
        options: JSON.stringify(q.type === "MCQ" ? q.options : []),
        correct: JSON.stringify(
          q.type === "MCQ"
            ? { index: q.correctIndex }
            : { bool: q.correctBool },
        ),
        explanation: q.explanation,
      })),
    });
  });

  // Audit draft : status=APPROVED (déjà appliqué), pour alimenter le dashboard tokens.
  const draft = await db.aIDraft.create({
    data: {
      type: "QUEST_ENRICHMENT",
      payload: JSON.stringify(result.payload),
      aiModel: result.model,
      status: "APPROVED",
      reviewedAt: new Date(),
      reviewedBy: guard.user.id,
      publishedId: quest.id,
      tokensInput: result.usage.input + result.usage.cacheRead + result.usage.cacheCreated,
      tokensOutput: result.usage.output,
    },
  });

  await logAdminAction(guard.user.id, "AI_DRAFT_APPROVE", `ai_draft:${draft.id}`, {
    type: "QUEST_ENRICHMENT",
    questCode: code,
    sections: result.payload.theorySections.length,
    questions: result.payload.quizQuestions.length,
  });

  return Response.json({
    ok: true,
    questId: quest.id,
    sections: result.payload.theorySections.length,
    questions: result.payload.quizQuestions.length,
  });
}
