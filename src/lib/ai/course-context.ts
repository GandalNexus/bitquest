/**
 * Charge l'arbre complet d'un cours (chapters → lessons → linked quests)
 * pour alimenter le prompt IA en modes COURSE_FILL / ENRICH.
 *
 * Objectif : l'IA doit voir ce qui existe déjà pour (a) éviter les doublons,
 * (b) respecter la progression pédagogique, (c) choisir le bon ordre.
 */
import { db } from "@/lib/db";

export interface CourseTree {
  course: {
    slug: string;
    title: string;
    subtitle: string;
    description: string;
    published: boolean;
  };
  chapters: Array<{
    slug: string;
    title: string;
    summary: string;
    order: number;
    lessons: Array<{
      slug: string;
      title: string;
      summary: string;
      order: number;
      published: boolean;
    }>;
    linkedQuests: Array<{
      code: string;
      title: string;
      track: string;
      missionType: string;
    }>;
  }>;
}

export async function loadCourseTree(courseSlug: string): Promise<CourseTree | null> {
  const course = await db.course.findUnique({
    where: { slug: courseSlug },
    include: {
      chapters: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            select: {
              slug: true,
              title: true,
              summary: true,
              order: true,
              publishedAt: true,
            },
          },
          linkedQuests: {
            include: {
              quest: {
                select: { code: true, title: true, track: true, missionType: true },
              },
            },
          },
        },
      },
    },
  });

  if (!course) return null;

  return {
    course: {
      slug: course.slug,
      title: course.title,
      subtitle: course.subtitle,
      description: course.description,
      published: course.publishedAt !== null,
    },
    chapters: course.chapters.map((c) => ({
      slug: c.slug,
      title: c.title,
      summary: c.summary,
      order: c.order,
      lessons: c.lessons.map((l) => ({
        slug: l.slug,
        title: l.title,
        summary: l.summary,
        order: l.order,
        published: l.publishedAt !== null,
      })),
      linkedQuests: c.linkedQuests.map((lq) => ({
        code: lq.quest.code,
        title: lq.quest.title,
        track: lq.quest.track,
        missionType: lq.quest.missionType,
      })),
    })),
  };
}

/** Rendu Markdown compact de l'arbre, utilisé comme contexte de prompt. */
export function renderCourseTree(tree: CourseTree): string {
  const lines: string[] = [];
  lines.push(`## Cours ciblé : ${tree.course.title}`);
  lines.push(`slug: ${tree.course.slug}`);
  lines.push(`sous-titre: ${tree.course.subtitle}`);
  lines.push(`description: ${tree.course.description}`);
  lines.push(`publié: ${tree.course.published ? "oui" : "non"}`);
  lines.push("");

  if (tree.chapters.length === 0) {
    lines.push("Aucun chapitre.");
    return lines.join("\n");
  }

  lines.push("### Chapitres existants");
  for (const ch of tree.chapters) {
    lines.push(`\n**[${ch.order}] ${ch.title}** (slug: \`${ch.slug}\`)`);
    lines.push(`→ ${ch.summary}`);
    if (ch.lessons.length > 0) {
      lines.push("Leçons :");
      for (const l of ch.lessons) {
        const status = l.published ? "" : " _(brouillon)_";
        lines.push(`  - [${l.order}] ${l.title} (\`${l.slug}\`)${status}`);
      }
    } else {
      lines.push("_(aucune leçon)_");
    }
    if (ch.linkedQuests.length > 0) {
      lines.push("Quêtes liées :");
      for (const q of ch.linkedQuests) {
        lines.push(`  - ${q.title} (\`${q.code}\`, ${q.track}, mission=${q.missionType})`);
      }
    }
  }
  return lines.join("\n");
}
