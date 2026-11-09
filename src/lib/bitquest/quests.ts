import { db } from "@/lib/db";
import { levelFromXp } from "./progression";

export type QuestWithState = {
  id: string;
  code: string;
  track: string;
  order: number;
  title: string;
  subtitle: string;
  description: string;
  requiredLevel: number;
  xpReward: number;
  satsReward: number;
  missionType: string;
  totalSections: number;
  totalQuiz: number;
  status: string;
  sectionsRead: number;
  quizBestScore: number;
  perfectQuiz: boolean;
  completedAt: string | null;
  locked: boolean;
  lockReason: string | null;
};

/** Charge toutes les quêtes avec leur état de déblocage/progression pour un utilisateur. */
export async function getQuestsWithState(userId: string): Promise<QuestWithState[]> {
  const [quests, progressRows, user] = await Promise.all([
    db.quest.findMany({
      orderBy: { order: "asc" },
      include: { quizQuestions: { select: { id: true } } },
    }),
    db.userQuestProgress.findMany({ where: { userId } }),
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true } }),
  ]);

  const level = levelFromXp(user.xp);
  const progressByQuest = new Map(progressRows.map((p) => [p.questId, p]));
  const completedByTrack = new Map<string, string[]>(); // track -> codes complétés (ordre)

  const byCode = new Map(quests.map((q) => [q.code, q]));

  const result: QuestWithState[] = [];
  for (const quest of quests) {
    const p = progressByQuest.get(quest.id);
    // Détermine la quête précédente dans la même piste
    const prevInTrack = quests.find((q) => q.track === quest.track && q.order === quest.order - 1);
    const prevCompleted = prevInTrack ? progressByQuest.get(prevInTrack.id)?.status === "COMPLETED" : true;

    const levelOk = level >= quest.requiredLevel;
    const locked = !levelOk || !prevCompleted;
    let lockReason: string | null = null;
    if (!levelOk) {
      lockReason = `Niveau ${quest.requiredLevel} requis`;
    } else if (!prevCompleted) {
      lockReason = `Termine d'abord « ${prevInTrack?.title} »`;
    }

    result.push({
      id: quest.id,
      code: quest.code,
      track: quest.track,
      order: quest.order,
      title: quest.title,
      subtitle: quest.subtitle,
      description: quest.description,
      requiredLevel: quest.requiredLevel,
      xpReward: quest.xpReward,
      satsReward: quest.satsReward,
      missionType: quest.missionType,
      totalSections: quest.theorySections ? (JSON.parse(quest.theorySections) as unknown[]).length : 0,
      totalQuiz: quest.quizQuestions.length,
      status: p?.status ?? "AVAILABLE",
      sectionsRead: p?.sectionsRead ?? 0,
      quizBestScore: p?.quizBestScore ?? 0,
      perfectQuiz: p?.perfectQuiz ?? false,
      completedAt: p?.completedAt ? p.completedAt.toISOString() : null,
      locked,
      lockReason,
    });
    void byCode;
    void completedByTrack;
  }
  return result;
}
