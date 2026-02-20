'use server';

import { db } from '@/db';
import { quests, quizzes, userQuestProgress, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';
import type { QuizAttempt } from '@/types/quest';

export async function getUserQuests(userId: number) {
  const userProgress = await db
    .select()
    .from(userQuestProgress)
    .where(eq(userQuestProgress.userId, userId));

  const allQuests = await db.select().from(quests).where(eq(quests.isActive, true));

  return allQuests.map(quest => {
    const progress = userProgress.find(p => p.questId === quest.id);
    return {
      ...quest,
      status: progress?.status || 'locked',
      quizPassed: progress?.quizPassed || false,
      practicalCompleted: progress?.practicalCompleted || false,
    };
  });
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
  const userId = cookieStore.get('user_session')?.value;
  
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
        eq(userQuestProgress.userId, parseInt(userId)),
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
      userId: parseInt(userId),
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
  const userId = cookieStore.get('user_session')?.value;
  
  if (!userId) return { error: 'Not authenticated' };

  const quest = await getQuestById(questId);
  if (!quest) return { error: 'Quest not found' };

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
        eq(userQuestProgress.userId, parseInt(userId)),
        eq(userQuestProgress.questId, questId)
      )
    );

  // Award XP and sats
  const [currentUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, parseInt(userId)));

  if (currentUser) {
    await db
      .update(users)
      .set({
        xp: (currentUser.xp || 0) + quest.xpReward,
        sats: (currentUser.sats || 0) + quest.satsReward,
      })
      .where(eq(users.id, parseInt(userId)));
  }

  return { 
    success: true, 
    rewards: { 
      xp: quest.xpReward, 
      sats: quest.satsReward 
    } 
  };
}

export async function unlockNextQuest(currentQuestId: number) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_session')?.value;
  
  if (!userId) return { error: 'Not authenticated' };

  const nextQuest = await db
    .select()
    .from(quests)
    .where(eq(quests.order, currentQuestId + 1));

  if (nextQuest.length > 0) {
    await db.insert(userQuestProgress).values({
      userId: parseInt(userId),
      questId: nextQuest[0].id,
      status: 'available',
    });
  }

  return { success: true };
}
