import { PrismaClient } from "@prisma/client";
import { questsSeed, badgesSeed, botUsersSeed } from "../src/lib/seed-data";
import crypto from "crypto";

const db = new PrismaClient();

async function main() {
  console.log("Seeding BitQuest...");

  /* ---- Badges ---- */
  for (const b of badgesSeed) {
    await db.badge.upsert({
      where: { code: b.code },
      update: {
        name: b.name,
        description: b.description,
        icon: b.icon,
        rarity: b.rarity,
        conditionType: b.conditionType,
        conditionValue: JSON.stringify(b.conditionValue),
      },
      create: {
        code: b.code,
        name: b.name,
        description: b.description,
        icon: b.icon,
        rarity: b.rarity,
        conditionType: b.conditionType,
        conditionValue: JSON.stringify(b.conditionValue),
      },
    });
  }
  console.log(`Badges: ${badgesSeed.length}`);

  /* ---- Quêtes + quiz ---- */
  for (const q of questsSeed) {
    const missionConfig = JSON.stringify({
      ...q.missionConfig,
      brief: q.missionBrief,
      hint: q.missionHint,
    });
    const data = {
      track: q.track,
      order: q.order,
      title: q.title,
      subtitle: q.subtitle,
      description: q.description,
      intro: q.intro,
      theorySections: JSON.stringify(q.theorySections),
      xpReward: q.xpReward,
      satsReward: q.satsReward,
      requiredLevel: q.requiredLevel,
      missionType: q.missionType,
      missionConfig,
    };
    const quest = await db.quest.upsert({
      where: { code: q.code },
      update: data,
      create: { code: q.code, ...data },
    });
    // Régénère les questions du quiz
    await db.quizQuestion.deleteMany({ where: { questId: quest.id } });
    await db.quizQuestion.createMany({
      data: q.quiz.map((quiz, i) => ({
        questId: quest.id,
        order: i + 1,
        type: quiz.type,
        question: quiz.question,
        options: JSON.stringify(quiz.options ?? []),
        correct: JSON.stringify(
          quiz.type === "MCQ" ? { index: quiz.correctIndex ?? 0 } : { bool: quiz.correctBool ?? false },
        ),
        explanation: quiz.explanation,
      })),
    });
  }
  console.log(`Quêtes: ${questsSeed.length}`);

  /* ---- Utilisateurs bot pour le classement ---- */
  for (const bot of botUsersSeed) {
    const existing = await db.user.findUnique({ where: { pseudo: bot.pseudo } });
    if (!existing) {
      await db.user.create({
        data: {
          pseudo: bot.pseudo,
          isBot: true,
          token: crypto.randomBytes(24).toString("hex"),
          xp: bot.xp,
          sats: bot.sats,
          satsEarnedTotal: bot.sats,
          lastActiveDate: new Date().toISOString().slice(0, 10),
        },
      });
    }
  }
  console.log(`Bots: ${botUsersSeed.length}`);
  console.log("Seed terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
