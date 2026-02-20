'use server';

import { db } from '@/db';
import { quests, quizzes, userQuestProgress, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';
import type { QuizAttempt } from '@/types/quest';
import { verifySessionToken } from '@/lib/session';

export async function getUserQuests(userId: number) {
  const results = await db
    .select({
      quest: quests,
      progress: userQuestProgress,
    })
    .from(quests)
    .leftJoin(
      userQuestProgress,
      and(
        eq(userQuestProgress.questId, quests.id),
        eq(userQuestProgress.userId, userId)
      )
    )
    .where(eq(quests.isActive, true));

  return results.map(({ quest, progress }) => ({
    ...quest,
    status: progress?.status || 'locked',
    quizPassed: progress?.quizPassed || false,
    practicalCompleted: progress?.practicalCompleted || false,
  }));
}

export async function getQuestById(questId: number) {
  const [quest] = await db.select().from(quests).where(eq(quests.id, questId));
  return quest;
}

export async function getQuizByQuestId(questId: number) {
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.questId, questId));
  return quiz;
}

export async function submitQuiz(questId: number, attempt: QuizAttempt) {
  const cookieStore = await cookies();
  const token = cookieStore.get('user_session')?.value;
  const userId = token ? await verifySessionToken(token) : null;

  if (!userId) return { error: 'Not authenticated' };

  const quiz = await getQuizByQuestId(questId);
  if (!quiz) return { error: 'Quiz not found' };

  const passed = attempt.score >= (quiz.passingScore || 70);

  // Update or create progress
  const [existing] = await db
    .select()
    .from(userQuestProgress)
    .where(
      and(
        eq(userQuestProgress.userId, userId),
        eq(userQuestProgress.questId, questId)
      )
    );

  if (existing) {
    await db
      .update(userQuestProgress)
      .set({
        quizScore: attempt.score,
        quizPassed: passed,
        status: passed ? 'in_progress' : 'available',
      })
      .where(eq(userQuestProgress.id, existing.id));
  } else {
    await db.insert(userQuestProgress).values({
      userId: userId,
      questId,
      status: passed ? 'in_progress' : 'available',
      quizScore: attempt.score,
      quizPassed: passed,
    });
  }

  return { success: true, passed, score: attempt.score };
}

export async function completeQuest(questId: number) {
  const cookieStore = await cookies();
  const token = cookieStore.get('user_session')?.value;
  const userId = token ? await verifySessionToken(token) : null;

  if (!userId) return { error: 'Not authenticated' };

  const quest = await getQuestById(questId);
  if (!quest) return { error: 'Quest not found' };

  // FIX: Idempotency guard — do not award rewards if already completed.
  const [existing] = await db
    .select()
    .from(userQuestProgress)
    .where(
      and(
        eq(userQuestProgress.userId, userId),
        eq(userQuestProgress.questId, questId)
      )
    );

  if (existing?.status === 'completed') {
    return {
      success: true,
      rewards: { xp: 0, sats: 0 },
      alreadyCompleted: true,
    };
  }

  // Mark quest as completed
  await db
    .update(userQuestProgress)
    .set({
      status: 'completed',
      practicalCompleted: true,
      completedAt: new Date(),
    })
    .where(
      and(
        eq(userQuestProgress.userId, userId),
        eq(userQuestProgress.questId, questId)
      )
    );

  // Award XP and sats
  const [currentUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId));

  if (currentUser) {
    await db
      .update(users)
      .set({
        xp: (currentUser.xp || 0) + quest.xpReward,
        sats: (currentUser.sats || 0) + quest.satsReward,
      })
      .where(eq(users.id, userId));
  }

  return {
    success: true,
    alreadyCompleted: false,
    rewards: {
      xp: quest.xpReward,
      sats: quest.satsReward
    }
  };
}

export async function unlockNextQuest(currentQuestId: number) {
  const cookieStore = await cookies();
  const token = cookieStore.get('user_session')?.value;
  const userId = token ? await verifySessionToken(token) : null;

  if (!userId) return { error: 'Not authenticated' };

  // FIX: Fetch the current quest first to get its `order`.
  // Previously the code used `currentQuestId + 1` which confused quest `id`
  // with quest `order` — they are not the same field.
  const currentQuest = await getQuestById(currentQuestId);
  if (!currentQuest) return { success: true }; // nothing to unlock

  const nextQuest = await db
    .select()
    .from(quests)
    .where(eq(quests.order, currentQuest.order + 1));

  if (nextQuest.length > 0) {
    // Check if progress already exists to avoid duplicate inserts
    const [alreadyUnlocked] = await db
      .select()
      .from(userQuestProgress)
      .where(
        and(
          eq(userQuestProgress.userId, userId),
          eq(userQuestProgress.questId, nextQuest[0].id)
        )
      );

    if (!alreadyUnlocked) {
      await db.insert(userQuestProgress).values({
        userId: userId,
        questId: nextQuest[0].id,
        status: 'available',
      });
    }
  }

  return { success: true };
}
