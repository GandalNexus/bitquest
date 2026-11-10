import { db } from "@/lib/db";
import { awardSats, awardXp } from "./progression";

/* ============================================================
 * Défi du jour — Phase 2.8
 *
 * Un défi par journée calendaire UTC. Les défis sont seedés à l'avance
 * (voir src/lib/challenges-seed.ts). Pas de génération automatique :
 * si aucun défi n'existe pour aujourd'hui, l'endpoint renvoie null et
 * la tuile se cache côté UI.
 * ============================================================ */

export interface TodayChallengeView {
  id: string;
  date: string;
  title: string;
  prompt: string;
  xpReward: number;
  satsReward: number;
  completed: boolean;
  completedAt: string | null;
}

/** Retourne la date UTC du jour au format ISO day "YYYY-MM-DD". */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Lit le défi du jour (s'il existe) + l'état de complétion pour l'utilisateur. */
export async function getTodayChallenge(userId: string | null): Promise<TodayChallengeView | null> {
  const date = todayUtc();
  const challenge = await db.dailyChallenge.findUnique({ where: { date } });
  if (!challenge) return null;

  let completedAt: Date | null = null;
  if (userId) {
    const completion = await db.dailyChallengeCompletion.findUnique({
      where: { userId_challengeId: { userId, challengeId: challenge.id } },
      select: { completedAt: true },
    });
    completedAt = completion?.completedAt ?? null;
  }

  return {
    id: challenge.id,
    date: challenge.date,
    title: challenge.title,
    prompt: challenge.prompt,
    xpReward: challenge.xpReward,
    satsReward: challenge.satsReward,
    completed: completedAt !== null,
    completedAt: completedAt?.toISOString() ?? null,
  };
}

/**
 * Marque le défi du jour comme complété pour l'utilisateur et distribue XP + sats.
 *
 * - Idempotent : si déjà complété, aucune récompense supplémentaire.
 * - Les sats passent par awardSats() (plafond quotidien + bonus streak).
 * - Les XP passent par awardXp() (UserEvent LEVEL_UP si applicable).
 */
export async function completeTodayChallenge(userId: string): Promise<
  | {
      ok: true;
      alreadyCompleted: boolean;
      xpGained: number;
      satsGranted: number;
      satsCapped: boolean;
    }
  | { ok: false; reason: "NO_CHALLENGE" }
> {
  const date = todayUtc();
  const challenge = await db.dailyChallenge.findUnique({ where: { date } });
  if (!challenge) return { ok: false, reason: "NO_CHALLENGE" };

  const existing = await db.dailyChallengeCompletion.findUnique({
    where: { userId_challengeId: { userId, challengeId: challenge.id } },
  });
  if (existing) {
    return { ok: true, alreadyCompleted: true, xpGained: 0, satsGranted: 0, satsCapped: false };
  }

  await db.dailyChallengeCompletion.create({
    data: { userId, challengeId: challenge.id },
  });

  const xpResult = challenge.xpReward > 0
    ? await awardXp(userId, challenge.xpReward, "daily-challenge")
    : { xpGained: 0 };

  let satsResult = { granted: 0, capped: false };
  if (challenge.satsReward > 0) {
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const award = await awardSats(userId, challenge.satsReward, user.streak, `Défi : ${challenge.title}`);
    if (award.granted > 0) {
      await db.user.update({
        where: { id: userId },
        data: {
          sats: { increment: award.granted },
          satsEarnedTotal: { increment: award.granted },
        },
      });
    }
    satsResult = { granted: award.granted, capped: award.capped };
  }

  await db.userEvent.create({
    data: {
      userId,
      type: "DAILY_CHALLENGE_COMPLETED",
      payload: JSON.stringify({
        challengeId: challenge.id,
        date: challenge.date,
        title: challenge.title,
        xp: xpResult.xpGained,
        sats: satsResult.granted,
      }),
    },
  });

  return {
    ok: true,
    alreadyCompleted: false,
    xpGained: xpResult.xpGained,
    satsGranted: satsResult.granted,
    satsCapped: satsResult.capped,
  };
}
