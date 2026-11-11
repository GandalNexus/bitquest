import { db } from "@/lib/db";
import { authenticate, unauthorized } from "@/lib/bitquest/session";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const user = await authenticate(req);
  if (!user) return unauthorized();
  const { code } = await params;

  const quest = await db.quest.findUnique({
    where: { code },
    include: { quizQuestions: { orderBy: { order: "asc" } } },
  });
  if (!quest) return Response.json({ error: "Quête introuvable." }, { status: 404 });

  const progress = await db.userQuestProgress.findUnique({
    where: { userId_questId: { userId: user.id, questId: quest.id } },
  });

  const theorySections = JSON.parse(quest.theorySections || "[]");
  const missionConfig = JSON.parse(quest.missionConfig || "{}");

  // Sanitize : jamais les bonnes réponses côté client
  return Response.json({
    quest: {
      code: quest.code,
      track: quest.track,
      order: quest.order,
      title: quest.title,
      subtitle: quest.subtitle,
      description: quest.description,
      intro: quest.intro,
      theorySections,
      xpReward: quest.xpReward,
      satsReward: quest.satsReward,
      requiredLevel: quest.requiredLevel,
      missionType: quest.missionType,
      missionKind: quest.missionKind,
    },
    quiz: quest.quizQuestions.map((q) => ({
      id: q.id,
      type: q.type,
      question: q.question,
      options: JSON.parse(q.options || "[]"),
    })),
    progress: progress
      ? {
          status: progress.status,
          sectionsRead: progress.sectionsRead,
          quizBestScore: progress.quizBestScore,
          quizAttempts: progress.quizAttempts,
          missionAttempts: progress.missionAttempts,
          missionProof: progress.missionProof ? JSON.parse(progress.missionProof) : null,
          completedAt: progress.completedAt?.toISOString() ?? null,
        }
      : null,
    missionMeta: { brief: missionConfig.brief ?? null, hint: missionConfig.hint ?? null },
  });
}
