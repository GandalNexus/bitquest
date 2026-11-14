import { PrismaClient } from "@prisma/client";
import { questsSeed, badgesSeed, botUsersSeed } from "../src/lib/seed-data";
import { academyCoursesSeed } from "../src/lib/academy-seed";
import { dailyChallengesSeed, offsetIsoDay } from "../src/lib/challenges-seed";
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
    // Phase 3 : quêtes dont la mission admet une preuve on-chain réelle.
    // Les autres restent en SIMULATED (mission locale générée par
    // src/lib/bitquest/missions.ts) : key_forge (crypto locale pure),
    // multisig_sign et taproot_tweak (exercices cryptographiques sans
    // broadcast), mine_nonce (impossible de réellement miner),
    // block_explorer/genesis (introduction gentle).
    //
    // NB : `lightning` (kind=CHANNEL) requiert qu'un node LND testnet
    // soit configuré côté serveur (LND_REST_URL + LND_MACAROON_HEX,
    // cf. docs/DOCKER_LND.md). Sans LND, /api/bitlab/proof répond 501
    // UNAVAILABLE — l'apprenant voit un message explicite et la quête
    // reste en attente d'un ops avec un node LND opérationnel.
    const BITLAB_PROOF_QUESTS = new Set([
      "tx-basics",
      "utxo",
      "fees-mempool",
      "lightning-invoice",
      "lightning",
    ]);
    const missionKind = BITLAB_PROOF_QUESTS.has(q.code) ? "BITLAB_PROOF" : "SIMULATED";
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
      missionKind,
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

  /* ---- Académie — Cours / Chapitres / Leçons ---- */
  // Upserts idempotents : jamais de delete sur les leçons ou les chapitres,
  // afin de préserver les LessonProgress des utilisateurs.
  let courseOrder = 0;
  let totalChapters = 0;
  let totalLessons = 0;
  for (const course of academyCoursesSeed) {
    courseOrder += 1;
    const courseRow = await db.course.upsert({
      where: { slug: course.slug },
      update: {
        title: course.title,
        subtitle: course.subtitle,
        description: course.description,
        coverIcon: course.coverIcon,
        order: courseOrder,
        publishedAt: new Date(),
      },
      create: {
        slug: course.slug,
        title: course.title,
        subtitle: course.subtitle,
        description: course.description,
        coverIcon: course.coverIcon,
        order: courseOrder,
        publishedAt: new Date(),
      },
    });

    let chapterOrder = 0;
    for (const chapter of course.chapters) {
      chapterOrder += 1;
      totalChapters += 1;
      const chapterRow = await db.chapter.upsert({
        where: { courseId_slug: { courseId: courseRow.id, slug: chapter.slug } },
        update: {
          title: chapter.title,
          summary: chapter.summary,
          order: chapterOrder,
        },
        create: {
          courseId: courseRow.id,
          slug: chapter.slug,
          title: chapter.title,
          summary: chapter.summary,
          order: chapterOrder,
        },
      });

      let lessonOrder = 0;
      for (const lesson of chapter.lessons) {
        lessonOrder += 1;
        totalLessons += 1;
        await db.lesson.upsert({
          where: { chapterId_slug: { chapterId: chapterRow.id, slug: lesson.slug } },
          update: {
            title: lesson.title,
            summary: lesson.summary,
            content: lesson.content,
            estimatedMinutes: lesson.estimatedMinutes,
            order: lessonOrder,
            publishedAt: new Date(),
          },
          create: {
            chapterId: chapterRow.id,
            slug: lesson.slug,
            title: lesson.title,
            summary: lesson.summary,
            content: lesson.content,
            estimatedMinutes: lesson.estimatedMinutes,
            order: lessonOrder,
            publishedAt: new Date(),
          },
        });
      }
    }
  }
  console.log(
    `Académie : ${academyCoursesSeed.length} cours · ${totalChapters} chapitres · ${totalLessons} leçons`,
  );

  /* ---- Défis du jour (fenêtre glissante 7 jours à partir d'aujourd'hui) ---- */
  const today = new Date().toISOString().slice(0, 10);
  for (const c of dailyChallengesSeed) {
    const date = offsetIsoDay(today, c.dayOffset);
    await db.dailyChallenge.upsert({
      where: { date },
      update: {
        title: c.title,
        prompt: c.prompt,
        xpReward: c.xpReward,
        satsReward: c.satsReward,
      },
      create: {
        date,
        title: c.title,
        prompt: c.prompt,
        xpReward: c.xpReward,
        satsReward: c.satsReward,
      },
    });
  }
  console.log(`Défis du jour : ${dailyChallengesSeed.length} seedés (fenêtre aujourd'hui + 6 j)`);

  /* ---- Membres de l'équipe GandalNexus (landing /gandalnexus) ---- */
  // upsert par `name` logique : pas d'unique côté DB mais on idempotisera
  // via findFirst + create/update pour que `npm run db:seed` soit safe à
  // rejouer. On évite d'écraser les éditions faites en prod via l'admin.
  const seededMembers = [
    {
      name: "Alhassane Diallo",
      role: "Lead ingénieur · architecte",
      contribution:
        "Design système, auth, protocole BitQuest ↔ BitLab, infra Docker et CI.",
      initials: "AD",
      order: 0,
    },
    {
      name: "Contributeurs GandalNexus",
      role: "Collective communautaire",
      contribution:
        "Pédagogie, i18n (FR/EN/Wolof), missions BitLab, docs, revue sécurité.",
      initials: "GN",
      order: 1,
    },
  ];
  for (const m of seededMembers) {
    const existing = await db.teamMember.findFirst({ where: { name: m.name } });
    if (existing) continue; // ne pas écraser une édition manuelle
    await db.teamMember.create({
      data: {
        name: m.name,
        role: m.role,
        contribution: m.contribution,
        initials: m.initials,
        order: m.order,
        publishedAt: new Date(),
      },
    });
  }
  console.log(`Équipe : ${seededMembers.length} membres seedés (idempotent)`);

  /* ---- Feature flags (P3/P4) ---- */
  const seededFlags = [
    {
      key: "lightning.rewards",
      description:
        "Active les récompenses Lightning réelles (payment via LND). OFF par défaut : les quêtes distribuent uniquement des sats simulés tant que le flag n'est pas armé par un admin.",
    },
  ];
  for (const f of seededFlags) {
    await db.featureFlag.upsert({
      where: { key: f.key },
      update: { description: f.description },
      create: { key: f.key, description: f.description, enabled: false },
    });
  }
  console.log(`Feature flags : ${seededFlags.length} seedés`);

  console.log("Seed terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
