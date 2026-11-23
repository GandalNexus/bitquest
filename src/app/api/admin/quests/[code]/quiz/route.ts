import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { adminQuestQuizSchema, parseJsonBody } from "@/lib/validation/schemas";

/**
 * PATCH /api/admin/quests/[code]/quiz — remplace l'intégralité des questions
 * du quiz pour une quête (bulk replace via transaction).
 *
 * Les options et la bonne réponse sont sérialisées au format compatible avec
 * l'existant :
 *   - MCQ        → options = [string, ...], correct = { index: number }
 *   - TRUE_FALSE → options = [],              correct = { bool: boolean }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "EDITOR");
  if (!guard.ok) return guard.response;

  const { code } = await params;
  const quest = await db.quest.findUnique({ where: { code } });
  if (!quest) {
    return Response.json({ error: "Quête introuvable." }, { status: 404 });
  }

  const parsed = await parseJsonBody(req, adminQuestQuizSchema);
  if (!parsed.ok) return parsed.response;
  const { questions } = parsed.data;

  await db.$transaction([
    db.quizQuestion.deleteMany({ where: { questId: quest.id } }),
    db.quizQuestion.createMany({
      data: questions.map((q, i) => {
        const base = {
          questId: quest.id,
          order: i + 1,
          type: q.type,
          question: q.question,
          explanation: q.explanation,
        };
        if (q.type === "MCQ") {
          return {
            ...base,
            options: JSON.stringify(q.options),
            correct: JSON.stringify({ index: q.correctIndex }),
          };
        }
        return {
          ...base,
          options: JSON.stringify([]),
          correct: JSON.stringify({ bool: q.correctBool }),
        };
      }),
    }),
  ]);

  await logAdminAction(guard.user.id, "QUEST_QUIZ_UPDATE", `quest:${quest.id}`, {
    code: quest.code,
    questionCount: questions.length,
  });

  return Response.json({ ok: true, questionCount: questions.length });
}
