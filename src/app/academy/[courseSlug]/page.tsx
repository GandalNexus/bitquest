"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api, type AcademyCourseTreeDTO } from "@/lib/bitquest/client";
import { EmptyState, ErrorState, LoadingState } from "@/components/bitquest/ui-bits";
import { selectNextLesson } from "@/lib/bitquest/academy";

export default function CoursePage({ params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = use(params);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["academy", "course", courseSlug],
    queryFn: () => api.academyCourse(courseSlug),
    retry: 1,
  });

  if (isLoading) return <LoadingState label="Chargement du cours…" />;
  if (isError || !data?.course) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <BackLink />
        <ErrorState
          message="Impossible de charger ce cours. Il n'existe peut-être pas ou n'est pas publié."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const course = data.course;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <BackLink />
      <CourseHero course={course} />
      <Chapters course={course} />
    </div>
  );
}

function BackLink() {
  return (
    <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
      <Link href="/academy">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Retour au catalogue
      </Link>
    </Button>
  );
}

function CourseHero({ course }: { course: AcademyCourseTreeDTO }) {
  const next = pickNextLessonFromTree(course);
  const isComplete = course.totalLessons > 0 && course.completedLessons === course.totalLessons;
  return (
    <Card className="mb-6 rounded-xl">
      <CardHeader className="gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <GraduationCap className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0">
            <CardTitle className="font-display text-2xl">{course.title}</CardTitle>
            <CardDescription>{course.subtitle}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{course.description}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {course.chapters.length} chapitre{course.chapters.length > 1 ? "s" : ""} ·{" "}
            {course.totalLessons} leçon{course.totalLessons > 1 ? "s" : ""}
          </span>
          <span>
            {course.completedLessons}/{course.totalLessons} ({course.pct}%)
          </span>
        </div>
        <Progress
          value={course.pct}
          className="h-2"
          aria-label={`Progression du cours : ${course.pct} %`}
        />
        {next && !isComplete && (
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href={`/academy/${course.slug}/${next.slug}`}>
              {course.completedLessons > 0 ? "Reprendre" : "Commencer"} : {next.title}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        )}
        {isComplete && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-500">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
            Cours terminé — bravo ! Tu peux revoir n&apos;importe quelle leçon à tout moment.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Chapters({ course }: { course: AcademyCourseTreeDTO }) {
  if (course.chapters.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Aucun chapitre publié pour l'instant"
        sub="Le contenu arrive très bientôt."
      />
    );
  }
  return (
    <ol className="space-y-4" aria-label="Chapitres du cours">
      {course.chapters.map((chapter, idx) => (
        <li key={chapter.id}>
          <Card className={chapter.locked ? "rounded-xl opacity-70" : "rounded-xl"}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span
                    className={
                      chapter.locked
                        ? "inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground"
                        : "inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm text-primary"
                    }
                  >
                    {chapter.locked ? <Lock className="h-3.5 w-3.5" aria-hidden /> : idx + 1}
                  </span>
                  {chapter.title}
                </CardTitle>
              </div>
              <CardDescription>{chapter.summary}</CardDescription>
              {chapter.locked && chapter.prerequisites.length > 0 && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300"
                >
                  <Lock className="mr-1 inline h-3 w-3" aria-hidden />
                  Termine d&apos;abord
                  {chapter.prerequisites.map((p, i) => (
                    <span key={p.questCode}>
                      {i === 0 ? " " : ", "}
                      <Link
                        href={`/quests/${p.questCode}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {p.questTitle}
                      </Link>
                    </span>
                  ))}
                  {" "}pour débloquer ce chapitre.
                </div>
              )}
            </CardHeader>
            <CardContent>
              {chapter.lessons.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune leçon publiée dans ce chapitre.
                </p>
              ) : (
                <ul className="space-y-2">
                  {chapter.lessons.map((lesson) => (
                    <li key={lesson.id}>
                      <Link
                        href={`/academy/${course.slug}/${lesson.slug}`}
                        aria-disabled={chapter.locked}
                        className={
                          chapter.locked
                            ? "group flex items-center gap-3 rounded-lg border bg-background/40 p-3 opacity-60 pointer-events-none"
                            : "group flex items-center gap-3 rounded-lg border bg-background/60 p-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
                        }
                      >
                        <div
                          className={
                            lesson.completed
                              ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"
                              : chapter.locked
                                ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                                : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                          }
                          aria-hidden
                        >
                          {lesson.completed ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : chapter.locked ? (
                            <Lock className="h-4 w-4" />
                          ) : (
                            <BookOpen className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{lesson.title}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {lesson.summary}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="shrink-0 gap-1 text-[10px] text-muted-foreground"
                        >
                          <Clock className="h-3 w-3" aria-hidden />
                          {lesson.estimatedMinutes} min
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </li>
      ))}
    </ol>
  );
}

/**
 * Choisit la prochaine leçon non terminée en traversant l'arbre dans
 * l'ordre. Ignore les chapitres verrouillés : on ne proposera jamais
 * de reprendre dans un chapitre prérequis non satisfait.
 */
function pickNextLessonFromTree(
  course: AcademyCourseTreeDTO,
): { slug: string; title: string } | null {
  const flat = course.chapters
    .filter((ch) => !ch.locked)
    .flatMap((ch) =>
      ch.lessons.map((l) => ({
        id: l.id,
        slug: l.slug,
        title: l.title,
        completed: l.completed,
      })),
    );
  const next = selectNextLesson(
    flat,
    new Set(flat.filter((l) => l.completed).map((l) => l.id)),
  );
  return next ? { slug: next.slug, title: next.title } : null;
}
