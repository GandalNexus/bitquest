import { db } from "@/lib/db";
import { authenticate, unauthorized, rateLimit } from "@/lib/bitquest/session";
import { isCookieAuthenticated, requireCsrf } from "@/lib/auth/csrf";
import { logger } from "@/lib/log";

const log = logger("quest-progress");
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
import { parseJsonBody, questProgressBodySchema } from "@/lib/validation/schemas";
import { consumeBitlabProof } from "@/lib/bitlab/consume";
import { fireProofAttempt } from "@/lib/bitlab/audit";
import { snapshotAttemptResult } from "@/lib/bitlab/attempt";

type XpResult = Awaited<ReturnType<typeof awardXp>>;

async function touchStreak(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const { streak } = updateStreak(user);
  if (streak !== user.streak || user.lastActiveDate !== new Date().toISOString().slice(0, 10)) {
    await db.user.update({
      where: { id: userId },
      data: { streak, lastActiveDate: new Date().toISOString().slice(0, 10) },
    });
  }
  return db.user.findUniqueOrThrow({ where: { id: userId } });
}

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const user = await authenticate(req);
  if (!user) return unauthorized();
  if (isCookieAuthenticated(req)) {
    const csrf = requireCsrf(req, user.token);
    if (!csrf.ok) return csrf.response;
  }
  if (!(await rateLimit("progress:" + user.id, 100, 60_000))) {
    return Response.json({ error: "Trop de requêtes, ralentis un peu." }, { status: 429 });
  }
  const { code } = await params;
  const parsed = await parseJsonBody(req, questProgressBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const quest = await db.quest.findUnique({
    where: { code },
    include: { quizQuestions: { orderBy: { order: "asc" } } },
  });
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
    if (body.action === "start") {
      await touchStreak(user.id);
      let p = await ensureProgress();
      if (p.status === "AVAILABLE") {
        p = await db.userQuestProgress.update({ where: { id: p.id }, data: { status: "IN_PROGRESS" } });
      }
      return Response.json({ progress: p, user: publicUser(user) });
    }

    /* ---------- LECTURE DE SECTION THÉORIQUE ---------- */
    if (body.action === "read_section") {
      await touchStreak(user.id);
      let p = await ensureProgress();
      const total = (JSON.parse(quest.theorySections) as unknown[]).length;
      const index = body.sectionIndex;
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
      return Response.json({
        progress: p,
        xp,
        user: await db.user.findUniqueOrThrow({ where: { id: user.id } }).then(publicUser),
      });
    }

    /* ---------- SOUMISSION DU QUIZ ---------- */
    if (body.action === "quiz_submit") {
      await touchStreak(user.id);
      let p = await ensureProgress();
      const answers = body.answers;
      if (answers.length !== quest.quizQuestions.length) {
        return Response.json({ error: "Réponses incomplètes." }, { status: 400 });
      }
      const results = quest.quizQuestions.map((q, i) => {
        const correct = JSON.parse(q.correct || "{}");
        const ans = answers[i];
        const isCorrect =
          q.type === "TRUE_FALSE"
            ? Boolean(ans) === Boolean(correct.bool)
            : Number(ans) === Number(correct.index);
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
    if (body.action === "mission_start") {
      await touchStreak(user.id);
      const p = await ensureProgress();
      if (p.quizBestScore < QUIZ_PASS_THRESHOLD) {
        return Response.json(
          { error: "Réussis d'abord le quiz (score minimum 70 %) pour débloquer la mission." },
          { status: 403 },
        );
      }
      if (p.missionAttempts >= MISSION_MAX_ATTEMPTS && p.status !== "COMPLETED") {
        return Response.json(
          { error: "Nombre maximum de tentatives atteint pour cette mission. Reviens demain." },
          { status: 429 },
        );
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
    if (body.action === "mission_submit") {
      await touchStreak(user.id);
      const p = await ensureProgress();
      if (p.status === "COMPLETED") {
        return Response.json({ error: "Quête déjà complétée." }, { status: 400 });
      }
      if (p.missionAttempts >= MISSION_MAX_ATTEMPTS) {
        return Response.json({ error: "Nombre maximum de tentatives atteint." }, { status: 429 });
      }

      /**
       * Phase 3 : les quêtes BITLAB_PROOF utilisent une vraie preuve
       * (testnet/signet) persistée via /api/bitlab/proof. On consomme
       * une BitLabProof non-consumed à la place du simulated validator.
       *
       * Consommation atomique via `consumeBitlabProof` (updateMany conditionnel) :
       * garantit qu'un replay de `mission_submit` ne crédite les récompenses
       * qu'une seule fois, même en cas de requêtes concurrentes (P0.2).
       */
      let result: { success: boolean; feedback: string; proof?: Record<string, unknown> };
      if (quest.missionKind === "BITLAB_PROOF") {
        const startedAt = Date.now();
        const consumption = await consumeBitlabProof(db.bitLabProof, user.id, quest.code);

        if (consumption.status === "NO_PROOF") {
          await db.userQuestProgress.update({
            where: { id: p.id },
            data: { missionAttempts: p.missionAttempts + 1 },
          });
          const refreshed = await db.userQuestProgress.findUniqueOrThrow({ where: { id: p.id } });
          return Response.json({
            success: false,
            feedback:
              "Aucune preuve BitLab enregistrée. Soumets d'abord ta preuve via /api/bitlab/proof.",
            attemptsLeft: Math.max(0, MISSION_MAX_ATTEMPTS - refreshed.missionAttempts),
            progress: refreshed,
          });
        }

        if (consumption.status === "DUPLICATE") {
          // Replay après consommation. On NE crédite PAS les récompenses et on
          // trace un outcome DUPLICATE dans l'audit log BitLab.
          const existing = consumption.existing;
          fireProofAttempt({
            userId: user.id,
            questCode: quest.code,
            kind: existing.kind,
            network: existing.network,
            outcome: "DUPLICATE",
            reasonMessage: "mission_submit après consommation de la preuve",
            startedAt,
          });
          const refreshed = await db.userQuestProgress.findUniqueOrThrow({ where: { id: p.id } });
          const alreadyCompleted = refreshed.status === "COMPLETED";
          return Response.json({
            success: alreadyCompleted,
            idempotent: true,
            feedback: alreadyCompleted
              ? "Mission déjà validée — aucune récompense supplémentaire attribuée."
              : "Preuve BitLab déjà utilisée pour cette quête.",
            proof: alreadyCompleted && refreshed.missionProof
              ? (JSON.parse(refreshed.missionProof) as Record<string, unknown>)
              : undefined,
            progress: refreshed,
            attemptsLeft: Math.max(0, MISSION_MAX_ATTEMPTS - refreshed.missionAttempts),
          });
        }

        // consumption.status === "CONSUMED"
        const proof = consumption.proof;
        const parsedPayload = (() => {
          try {
            return JSON.parse(proof.payload) as Record<string, unknown>;
          } catch {
            return {};
          }
        })();
        result = {
          success: true,
          feedback: "Preuve BitLab vérifiée — mission validée !",
          proof: {
            type: proof.kind.toLowerCase(),
            network: proof.network,
            verifiedAt: proof.verifiedAt.toISOString(),
            ...parsedPayload,
          },
        };
      } else {
        // Chemin historique SIMULATED : validator local.
        if (!p.missionSession) {
          return Response.json(
            { error: "Aucune mission en cours. Lance d'abord la mission dans BitLab." },
            { status: 400 },
          );
        }
        const session = JSON.parse(p.missionSession) as {
          challenge: Record<string, unknown>;
          expected: Record<string, unknown>;
        };
        result = validateMission(quest.missionType, session, body.answer);
      }

      await db.userQuestProgress.update({
        where: { id: p.id },
        data: { missionAttempts: p.missionAttempts + 1 },
      });

      if (!result.success || !result.proof) {
        const refreshed = await db.userQuestProgress.findUniqueOrThrow({ where: { id: p.id } });
        return Response.json({
          success: false,
          feedback: result.feedback,
          attemptsLeft: Math.max(0, MISSION_MAX_ATTEMPTS - refreshed.missionAttempts),
          progress: refreshed,
        });
      }

      /* ---- Mission réussie : complétion atomique de la quête ----
       * updateMany conditionnel sur `status != COMPLETED` garantit que les
       * récompenses (XP mission, XP complétion, sats, events) ne sont
       * attribuées qu'une seule fois même en cas de double soumission
       * concurrente (P0.2 — idempotence stricte). */
      const completion = await db.userQuestProgress.updateMany({
        where: { id: p.id, status: { not: "COMPLETED" } },
        data: {
          missionProof: JSON.stringify(result.proof),
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });
      const justCompleted = completion.count > 0;

      let xp: XpResult | null = null;
      let bonusXp: XpResult | null = null;
      let satsResult = { granted: 0, fullReward: 0, streakBonusPct: 0, capped: false, streakBonus: 0 };

      if (justCompleted) {
        if (!p.missionProof) {
          xp = await awardXp(user.id, XP_RULES.MISSION_SUCCESS, "mission");
        }
        bonusXp = await awardXp(user.id, XP_RULES.QUEST_BONUS, "completion");
        await db.userEvent.create({
          data: {
            userId: user.id,
            type: "QUEST_COMPLETED",
            payload: JSON.stringify({ questCode: quest.code, questTitle: quest.title, proof: result.proof }),
          },
        });

        /* ---- Récompenses sats (plafond journalier + bonus streak) ---- */
        const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } });
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

      // LOT 4A — snapshot des récompenses dans la MissionAttempt active (si une
      // existe). Permet à la liste "Mes missions" (dashboard + bitlab) d'afficher
      // les gains sans refaire un join progress ↔ attempt. No-op silencieux si
      // pas d'attempt en cours (compat ascendante : les anciens flux sans
      // deep-link n'en créent pas).
      if (justCompleted) {
        await snapshotAttemptResult({
          userId: user.id,
          questCode: quest.code,
          result: {
            questStatus: "COMPLETED",
            xpEarned: (xp?.xpGained ?? 0) + (bonusXp?.xpGained ?? 0),
            satsEarned: satsResult.granted,
            satsCapped: satsResult.capped,
            streakBonusPct: satsResult.streakBonusPct,
            badges: newBadges.map((b) => ({ code: b.code, name: b.name })),
            completedAt: new Date().toISOString(),
          },
        });
      }

      return Response.json({
        success: true,
        feedback: result.feedback,
        proof: result.proof,
        progress: finalProgress,
        xp,
        bonusXp,
        sats: justCompleted ? satsResult : null,
        idempotent: !justCompleted,
        user: publicUser(finalUser),
        badges: newBadges,
      });
    }

    return Response.json({ error: "Action inconnue." }, { status: 400 });
  } catch (e) {
    log.error({ err: e, questCode: code, action: body.action, userId: user.id }, "progress handler failed");
    return Response.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
