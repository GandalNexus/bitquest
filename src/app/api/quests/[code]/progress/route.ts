import { db } from "@/lib/db";
import { authenticate, unauthorized, rateLimit } from "@/lib/bitquest/session";
import {
  XP_RULES,
  QUIZ_PASS_THRESHOLD,
  MISSION_MAX_ATTEMPTS,
  updateStreak,
  awardXp,
  awardSats,
  evaluateBadges,
  publicUser,
} from "@/lib/bitquest/progression";
import { generateMission, validateMission } from "@/lib/bitquest/missions";

type XpResult = Awaited<ReturnType<typeof awardXp>>;

async function touchStreak(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const { streak } = updateStreak(user);
  if (streak !== user.streak || user.lastActiveDate !== new Date().toISOString().slice(0, 10)) {
    await db.user.update({ where: { id: userId }, data: { streak, lastActiveDate: new Date().toISOString().slice(0, 10) } });
  }
  return db.user.findUniqueOrThrow({ where: { id: userId } });
}

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const user = await authenticate(req);
  if (!user) return unauthorized();
  if (!rateLimit("progress:" + user.id, 100, 60_000)) {
    return Response.json({ error: "Trop de requêtes, ralentis un peu." }, { status: 429 });
  }
  const { code } = await params;
  const body = await req.json();
  const action = body.action as string;

  const quest = await db.quest.findUnique({ where: { code }, include: { quizQuestions: { orderBy: { order: "asc" } } } });
  if (!quest) return Response.json({ error: "Quête introuvable." }, { status: 404 });

  let progress = await db.userQuestProgress.findUnique({
    where: { userId_questId: { userId: user.id, questId: quest.id } },
  });

  const ensureProgress = async () => {
    if (!progress) {
      progress = await db.userQuestProgress.create({
        data: { userId: user.id, questId: quest.id, status: "IN_PROGRESS" },
      });
    }
    return progress;
  };

  try {
    /* ---------- START ---------- */
    if (action === "start") {
      await touchStreak(user.id);
      let p = await ensureProgress();
      if (p.status === "AVAILABLE") {
        p = await db.userQuestProgress.update({ where: { id: p.id }, data: { status: "IN_PROGRESS" } });
      }
      return Response.json({ progress: p, user: publicUser(user) });
    }

    /* ---------- LECTURE DE SECTION THÉORIQUE ---------- */
    if (action === "read_section") {
      await touchStreak(user.id);
      let p = await ensureProgress();
      const total = (JSON.parse(quest.theorySections) as unknown[]).length;
      const index = Math.floor(Number(body.sectionIndex));
      if (index < 0 || index >= total) {
        return Response.json({ error: "Section invalide." }, { status: 400 });
      }
      let xp: XpResult | null = null;
      const alreadyRead = p.sectionsRead;
      if (index + 1 > alreadyRead) {
        const newRead = index + 1;
        const data: { sectionsRead: number; status?: string } = { sectionsRead: newRead };
        if (newRead >= total && (p.status === "AVAILABLE" || p.status === "IN_PROGRESS")) {
          data.status = "THEORY_DONE";
        }
        await db.userQuestProgress.update({ where: { id: p.id }, data });
        // XP de lecture : uniquement pour les nouvelles sections
        const newlyRead = newRead - alreadyRead;
        if (newlyRead > 0) {
          xp = await awardXp(user.id, XP_RULES.THEORY_SECTION * newlyRead, "theory");
        }
        p = await db.userQuestProgress.findUniqueOrThrow({ where: { id: p.id } });
      }
      return Response.json({ progress: p, xp, user: await db.user.findUniqueOrThrow({ where: { id: user.id } }).then(publicUser) });
    }

    /* ---------- SOUMISSION DU QUIZ ---------- */
    if (action === "quiz_submit") {
      await touchStreak(user.id);
      let p = await ensureProgress();
      const answers = Array.isArray(body.answers) ? body.answers : [];
      if (answers.length !== quest.quizQuestions.length) {
        return Response.json({ error: "Réponses incomplètes." }, { status: 400 });
      }
      const results = quest.quizQuestions.map((q, i) => {
        const correct = JSON.parse(q.correct || "{}");
        const ans = answers[i];
        const isCorrect = q.type === "TRUE_FALSE" ? Boolean(ans) === Boolean(correct.bool) : Number(ans) === Number(correct.index);
        return {
          index: i,
          isCorrect,
          correctIndex: q.type === "MCQ" ? Number(correct.index) : null,
          correctBool: q.type === "TRUE_FALSE" ? Boolean(correct.bool) : null,
          explanation: q.explanation,
        };
      });
      const score = Math.round((results.filter((r) => r.isCorrect).length / results.length) * 100);
      const passed = score >= QUIZ_PASS_THRESHOLD;
      const perfect = score === 100;

      const alreadyPassed = p.quizBestScore >= QUIZ_PASS_THRESHOLD;
      const data: {
        quizAttempts: number;
        quizBestScore: number;
        perfectQuiz: boolean;
        status?: string;
      } = {
        quizAttempts: p.quizAttempts + 1,
        quizBestScore: Math.max(p.quizBestScore, score),
        perfectQuiz: p.perfectQuiz || perfect,
      };
      if (passed && (p.status === "AVAILABLE" || p.status === "IN_PROGRESS" || p.status === "THEORY_DONE")) {
        data.status = "QUIZ_PASSED";
      }
      await db.userQuestProgress.update({ where: { id: p.id }, data });
      p = await db.userQuestProgress.findUniqueOrThrow({ where: { id: p.id } });

      let xp: XpResult | null = null;
      if (passed && !alreadyPassed) {
        xp = await awardXp(user.id, XP_RULES.QUIZ_PASS, "quiz");
      }
      const newBadges = await evaluateBadges(user.id);
      const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      return Response.json({
        score,
        passed,
        perfect,
        alreadyPassed,
        results,
        progress: p,
        xp,
        user: publicUser(refreshed),
        badges: newBadges,
      });
    }

    /* ---------- DÉMARRAGE MISSION BITLAB ---------- */
    if (action === "mission_start") {
      await touchStreak(user.id);
      const p = await ensureProgress();
      if (p.quizBestScore < QUIZ_PASS_THRESHOLD) {
        return Response.json({ error: "Réussis d'abord le quiz (score minimum 70 %) pour débloquer la mission." }, { status: 403 });
      }
      if (p.missionAttempts >= MISSION_MAX_ATTEMPTS && p.status !== "COMPLETED") {
        return Response.json({ error: "Nombre maximum de tentatives atteint pour cette mission. Reviens demain." }, { status: 429 });
      }
      const config = JSON.parse(quest.missionConfig || "{}");
      const { challenge, expected } = generateMission(quest.missionType, config);
      await db.userQuestProgress.update({
        where: { id: p.id },
        data: {
          missionSession: JSON.stringify({ challenge, expected }),
          status: p.status === "COMPLETED" ? "COMPLETED" : "QUIZ_PASSED",
        },
      });
      const refreshed = await db.userQuestProgress.findUniqueOrThrow({ where: { id: p.id } });
      return Response.json({
        challenge,
        missionType: quest.missionType,
        attemptsLeft: Math.max(0, MISSION_MAX_ATTEMPTS - p.missionAttempts),
        progress: refreshed,
      });
    }

    /* ---------- SOUMISSION MISSION BITLAB ---------- */
    if (action === "mission_submit") {
      await touchStreak(user.id);
      const p = await ensureProgress();
      if (!p.missionSession) {
        return Response.json({ error: "Aucune mission en cours. Lance d'abord la mission dans BitLab." }, { status: 400 });
      }
      if (p.status === "COMPLETED") {
        return Response.json({ error: "Quête déjà complétée." }, { status: 400 });
      }
      if (p.missionAttempts >= MISSION_MAX_ATTEMPTS) {
        return Response.json({ error: "Nombre maximum de tentatives atteint." }, { status: 429 });
      }
      const session = JSON.parse(p.missionSession) as { challenge: Record<string, unknown>; expected: Record<string, unknown> };
      const result = validateMission(quest.missionType, session, body.answer ?? {});
      await db.userQuestProgress.update({ where: { id: p.id }, data: { missionAttempts: p.missionAttempts + 1 } });

      if (!result.success || !result.proof) {
        const refreshed = await db.userQuestProgress.findUniqueOrThrow({ where: { id: p.id } });
        return Response.json({
          success: false,
          feedback: result.feedback,
          attemptsLeft: Math.max(0, MISSION_MAX_ATTEMPTS - refreshed.missionAttempts),
          progress: refreshed,
        });
      }

      /* ---- Mission réussie : XP mission + complétion de quête ---- */
      let xp: XpResult | null = null;
      if (!p.missionProof) {
        xp = await awardXp(user.id, XP_RULES.MISSION_SUCCESS, "mission");
      }
      await db.userQuestProgress.update({
        where: { id: p.id },
        data: { missionProof: JSON.stringify(result.proof), status: "COMPLETED", completedAt: new Date() },
      });

      // Bonus de complétion (une seule fois)
      let bonusXp: XpResult | null = null;
      const wasCompleted = p.completedAt !== null;
      if (!wasCompleted) {
        bonusXp = await awardXp(user.id, XP_RULES.QUEST_BONUS, "completion");
        await db.userEvent.create({
          data: {
            userId: user.id,
            type: "QUEST_COMPLETED",
            payload: JSON.stringify({ questCode: quest.code, questTitle: quest.title, proof: result.proof }),
          },
        });
      }

      /* ---- Récompenses sats (plafond journalier + bonus streak) ---- */
      const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      let satsResult = { granted: 0, fullReward: 0, streakBonusPct: 0, capped: false, streakBonus: 0 };
      if (!wasCompleted) {
        satsResult = await awardSats(user.id, quest.satsReward, fresh.streak, quest.title);
        await db.user.update({
          where: { id: user.id },
          data: {
            sats: { increment: satsResult.granted },
            satsEarnedTotal: { increment: satsResult.granted },
          },
        });
        if (satsResult.granted > 0) {
          await db.userEvent.create({
            data: {
              userId: user.id,
              type: "SATS_EARNED",
              payload: JSON.stringify({ amount: satsResult.granted, questCode: quest.code }),
            },
          });
        }
      }

      const newBadges = await evaluateBadges(user.id);
      const finalUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      const finalProgress = await db.userQuestProgress.findUniqueOrThrow({ where: { id: p.id } });

      return Response.json({
        success: true,
        feedback: result.feedback,
        proof: result.proof,
        progress: finalProgress,
        xp,
        bonusXp,
        sats: wasCompleted ? null : satsResult,
        user: publicUser(finalUser),
        badges: newBadges,
      });
    }

    return Response.json({ error: "Action inconnue." }, { status: 400 });
  } catch (e) {
    console.error("progress error", e);
    return Response.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
