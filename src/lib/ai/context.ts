/**
 * Collectes les taxonomies courantes (quests, lessons, chapters, challenges)
 * pour alimenter les prompts de génération. Fonctions pures côté DB.
 */
import { db } from "@/lib/db";
import type { DraftType } from "./schemas";
import type { GenerationContext } from "./generate";

export async function loadGenerationContext<T extends DraftType>(
  type: T,
): Promise<GenerationContext[T]> {
  switch (type) {
    case "QUEST": {
      const quests = await db.quest.findMany({
        select: { code: true, track: true, order: true, title: true, missionType: true },
        orderBy: [{ track: "asc" }, { order: "asc" }],
      });
      return quests as GenerationContext[T];
    }
    case "LESSON": {
      const lessons = await db.lesson.findMany({
        select: {
          slug: true,
          title: true,
          order: true,
          chapter: { select: { slug: true } },
        },
        orderBy: [{ order: "asc" }],
      });
      return lessons.map((l) => ({
        chapterSlug: l.chapter.slug,
        slug: l.slug,
        title: l.title,
        order: l.order,
      })) as GenerationContext[T];
    }
    case "CHAPTER": {
      const chapters = await db.chapter.findMany({
        select: {
          slug: true,
          title: true,
          order: true,
          course: { select: { slug: true } },
        },
        orderBy: [{ order: "asc" }],
      });
      return chapters.map((c) => ({
        courseSlug: c.course.slug,
        slug: c.slug,
        title: c.title,
        order: c.order,
      })) as GenerationContext[T];
    }
    case "CHALLENGE": {
      const challenges = await db.dailyChallenge.findMany({
        select: { date: true, title: true },
        orderBy: { date: "desc" },
        take: 60,
      });
      return challenges.map((c) => ({
        date: c.date,
        title: c.title,
      })) as GenerationContext[T];
    }
  }
  throw new Error(`Type non supporté : ${type as string}`);
}

export type { GenerationContext } from "./generate";
