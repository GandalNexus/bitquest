import { db } from "@/lib/db";

/* ============ NIVEAUX & XP ============ */

export const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200];

export const LEVEL_TITLES = [
  "Novice de la Genèse",
  "Apprenti HODLer",
  "Explorateur de Blocs",
  "Mineur en Herbe",
  "Gardien des Clés",
  "Opérateur Lightning",
  "Architecte du Protocole",
  "Nœud du Réseau",
  "Légende du Mempool",
  "Maître Satoshi",
];

export const XP_RULES = {
  THEORY_SECTION: 5,
  QUIZ_PASS: 30,
  MISSION_SUCCESS: 50,
  QUEST_BONUS: 20,
} as const;

export const SATS_DAILY_CAP = 10000;
export const QUIZ_PASS_THRESHOLD = 70;
export const MISSION_MAX_ATTEMPTS = 8;

export function levelFromXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return level;
}

export function levelInfo(xp: number) {
  const level = levelFromXp(xp);
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
  const current = LEVEL_THRESHOLDS[level - 1];
  const next = level < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[level] : null;
  const needed = next !== null ? next - current : 0;
  const into = xp - current;
  const pct = next !== null ? Math.min(100, Math.round((into / needed) * 100)) : 100;
  return { level, title, into, needed, next, pct };
}

/* ============ STREAK ============ */

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Met à jour le streak de l'utilisateur (appelé à chaque activité authentifiée). */
export function updateStreak(user: { streak: number; lastActiveDate: string | null }): {
  streak: number;
  changed: boolean;
} {
  const today = todayStr();
  if (user.lastActiveDate === today) return { streak: user.streak, changed: false };
  const next =
    user.lastActiveDate === yesterdayStr() ? user.streak + 1 : 1;
  return { streak: next, changed: true };
}

/* ============ SATS (plafond journalier anti-abus) ============ */

export async function awardSats(userId: string, amount: number, streak: number, questTitle: string) {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const todayTxs = await db.walletTransaction.findMany({
    where: { userId, createdAt: { gte: startOfDay } },
  });
  const earnedToday = todayTxs.reduce((acc, t) => acc + t.amount, 0);
  const streakBonusPct = Math.min(50, Math.max(0, streak - 1) * 10);
  const fullReward = amount + Math.round((amount * streakBonusPct) / 100);
  const room = Math.max(0, SATS_DAILY_CAP - earnedToday);
  const granted = Math.min(fullReward, room);
  const capped = granted < fullReward;

  const txs: { amount: number; type: string; description: string }[] = [];
  if (granted > 0) {
    const base = Math.min(amount, granted);
    txs.push({ amount: base, type: "QUEST_REWARD", description: `Quête complétée : ${questTitle}` });
    if (granted > base) {
      txs.push({
        amount: granted - base,
        type: "STREAK_BONUS",
        description: `Bonus de série (streak x${streak})`,
      });
    }
  }

  if (txs.length > 0) {
    await db.walletTransaction.createMany({ data: txs.map((t) => ({ ...t, userId })) });
  }

  return {
    granted,
    fullReward,
    streakBonusPct,
    capped,
    streakBonus: Math.max(0, granted - Math.min(amount, granted)),
  };
}

/* ============ BADGES ============ */

export type NewBadge = { code: string; name: string; description: string; icon: string; rarity: string };

/** Évalue toutes les conditions de badges et débloque ceux qui sont mérités. */
export async function evaluateBadges(userId: string): Promise<NewBadge[]> {
  const [user, allBadges, owned, progress, allQuests] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId } }),
    db.badge.findMany(),
    db.userBadge.findMany({ where: { userId }, include: { badge: true } }),
    db.userQuestProgress.findMany({ where: { userId, status: "COMPLETED" }, include: { quest: true } }),
    db.quest.findMany({ select: { id: true, track: true, code: true } }),
  ]);

  const ownedCodes = new Set(owned.map((o) => o.badge.code));
  const completedCodes = new Set(progress.map((p) => p.quest.code));
  const hasPerfect = await db.userQuestProgress.findFirst({
    where: { userId, perfectQuiz: true },
    select: { id: true },
  });
  const level = levelFromXp(user.xp);

  const earned: NewBadge[] = [];
  for (const badge of allBadges) {
    if (ownedCodes.has(badge.code)) continue;
    const cond = JSON.parse(badge.conditionValue || "{}");
    let ok = false;
    switch (badge.conditionType) {
      case "QUEST_COMPLETE":
        ok = completedCodes.has(cond.questCode);
        break;
      case "QUEST_COUNT":
        ok = progress.length >= (cond.count ?? 1);
        break;
      case "TRACK_COMPLETE": {
        const questIds = allQuests.filter((q) => q.track === cond.track).map((q) => q.id);
        const doneIds = progress.filter((p) => questIds.includes(p.questId)).map((p) => p.questId);
        ok = questIds.length > 0 && doneIds.length >= questIds.length;
        break;
      }
      case "STREAK":
        ok = user.streak >= (cond.days ?? 3);
        break;
      case "LEVEL":
        ok = level >= (cond.level ?? 1);
        break;
      case "SATS_TOTAL":
        ok = user.satsEarnedTotal >= (cond.sats ?? 10000);
        break;
      case "PERFECT_QUIZ":
        ok = Boolean(hasPerfect);
        break;
    }
    if (ok) {
      await db.userBadge.create({ data: { userId, badgeId: badge.id } });
      await db.userEvent.create({
        data: {
          userId,
          type: "BADGE_UNLOCKED",
          payload: JSON.stringify({ badgeCode: badge.code, badgeName: badge.name }),
        },
      });
      earned.push({
        code: badge.code,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        rarity: badge.rarity,
      });
    }
  }
  return earned;
}

/* ============ XP ============ */

export async function awardXp(userId: string, amount: number, reason: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const beforeLevel = levelFromXp(user.xp);
  const newXp = user.xp + amount;
  const afterLevel = levelFromXp(newXp);
  await db.user.update({ where: { id: userId }, data: { xp: newXp } });
  if (afterLevel > beforeLevel) {
    await db.userEvent.create({
      data: {
        userId,
        type: "LEVEL_UP",
        payload: JSON.stringify({ from: beforeLevel, to: afterLevel }),
      },
    });
  }
  return {
    xpGained: amount,
    reason,
    leveledUp: afterLevel > beforeLevel,
    newLevel: afterLevel,
    levelInfo: levelInfo(newXp),
  };
}

export function publicUser(user: {
  id: string;
  pseudo: string;
  email: string | null;
  isGuest: boolean;
  xp: number;
  sats: number;
  satsEarnedTotal: number;
  streak: number;
  lastActiveDate: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    pseudo: user.pseudo,
    email: user.email,
    isGuest: user.isGuest,
    xp: user.xp,
    sats: user.sats,
    satsEarnedTotal: user.satsEarnedTotal,
    streak: user.streak,
    lastActiveDate: user.lastActiveDate,
    createdAt: user.createdAt,
    levelInfo: levelInfo(user.xp),
  };
}
