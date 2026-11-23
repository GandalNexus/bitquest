"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api, type AcademyCourseTreeDTO } from "@/lib/bitquest/client";
import { ErrorState, LoadingState } from "@/components/bitquest/ui-bits";
import { useHasSession } from "@/lib/bitquest/hooks";

interface LessonLocation {
  lesson: AcademyCourseTreeDTO["chapters"][number]["lessons"][number];
  chapter: AcademyCourseTreeDTO["chapters"][number];
  index: number;
  flatLessons: {
    id: string;
    slug: string;
    title: string;
    completed: boolean;
  }[];
}

function locateLesson(course: AcademyCourseTreeDTO, lessonSlug: string): LessonLocation | null {
  const flat = course.chapters.flatMap((chapter) =>
    chapter.lessons.map((lesson) => ({ chapter, lesson })),
  );
  const idx = flat.findIndex((f) => f.lesson.slug === lessonSlug);
  if (idx === -1) return null;
  return {
    lesson: flat[idx].lesson,
    chapter: flat[idx].chapter,
    index: idx,
    flatLessons: flat.map(({ lesson }) => ({
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      completed: lesson.completed,
    })),
  };
}

export default function LessonPage({
  params,
}: {
  params: Promise<{ courseSlug: string; lessonSlug: string }>;
}) {
  const { courseSlug, lessonSlug } = use(params);
  const qc = useQueryClient();
  const hasSession = useHasSession();
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["academy", "course", courseSlug],
    queryFn: () => api.academyCourse(courseSlug),
    retry: 1,
  });

  const location = useMemo(
    () => (data?.course ? locateLesson(data.course, lessonSlug) : null),
    [data, lessonSlug],
  );

  if (isLoading) return <LoadingState label="Chargement de la leçon…" />;

  if (isError || !data?.course) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <BackLink courseSlug={courseSlug} />
        <ErrorState
          message="Impossible de charger la leçon."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (!location) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <BackLink courseSlug={courseSlug} />
        <ErrorState message="Cette leçon est introuvable dans le cours." />
      </div>
    );
  }

  const course = data.course;
  const { lesson, chapter, index, flatLessons } = location;
  const prev = index > 0 ? flatLessons[index - 1] : null;
  const next = index < flatLessons.length - 1 ? flatLessons[index + 1] : null;

  const handleComplete = async () => {
    if (!hasSession) {
      setErrorMsg("Connecte-toi depuis l'application pour enregistrer ta progression.");
      return;
    }
    setPending(true);
    setErrorMsg(null);
    try {
      await api.completeLesson(lesson.id);
      await qc.invalidateQueries({ queryKey: ["academy"] });
      await qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Erreur à l'enregistrement.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <BackLink courseSlug={courseSlug} />
      <LessonHeader
        course={course}
        chapter={chapter}
        lesson={lesson}
        currentIndex={index}
        total={flatLessons.length}
      />
      <article className="prose prose-invert mt-6 max-w-none dark:prose-invert">
        <ReactMarkdown>{lesson.content}</ReactMarkdown>
      </article>

      <Card className="mt-8 rounded-xl">
        <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {lesson.completed ? (
              <div className="flex items-center gap-2 text-sm text-emerald-500">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                Leçon terminée
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Prêt·e ? Marque cette leçon comme terminée pour avancer dans le cours.
              </p>
            )}
            {errorMsg && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {errorMsg}
              </p>
            )}
            {!hasSession && !errorMsg && (
              <p className="mt-1 text-xs text-muted-foreground">
                Connecte-toi depuis l&apos;app pour enregistrer ta progression.
              </p>
            )}
          </div>
          <Button
            onClick={handleComplete}
            disabled={pending || lesson.completed || !hasSession}
            size="lg"
            className="w-full sm:w-auto"
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Enregistrement…
              </>
            ) : lesson.completed ? (
              "Déjà terminée"
            ) : (
              <>
                Marquer comme terminée
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <nav
        aria-label="Navigation entre leçons"
        className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between"
      >
        {prev ? (
          <Button variant="outline" asChild className="justify-start">
            <Link href={`/academy/${course.slug}/${prev.slug}`}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              <span className="truncate">Leçon précédente — {prev.title}</span>
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {next ? (
          <Button asChild className="justify-end">
            <Link href={`/academy/${course.slug}/${next.slug}`}>
              <span className="truncate">Leçon suivante — {next.title}</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" asChild className="justify-end">
            <Link href={`/academy/${course.slug}`}>
              Retour au sommaire du cours
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        )}
      </nav>
    </div>
  );
}

function BackLink({ courseSlug }: { courseSlug: string }) {
  return (
    <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
      <Link href={`/academy/${courseSlug}`}>
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Retour au sommaire
      </Link>
    </Button>
  );
}

function LessonHeader({
  course,
  chapter,
  lesson,
  currentIndex,
  total,
}: {
  course: AcademyCourseTreeDTO;
  chapter: AcademyCourseTreeDTO["chapters"][number];
  lesson: AcademyCourseTreeDTO["chapters"][number]["lessons"][number];
  currentIndex: number;
  total: number;
}) {
  const position = `${currentIndex + 1} / ${total}`;
  return (
    <Card className="rounded-xl">
      <CardHeader className="gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href={`/academy/${course.slug}`} className="hover:text-foreground">
            {course.title}
          </Link>
          <span>·</span>
          <span className="truncate">{chapter.title}</span>
        </div>
        <CardTitle className="font-display text-xl sm:text-2xl">{lesson.title}</CardTitle>
        <CardDescription>{lesson.summary}</CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge
            variant="outline"
            className="gap-1 border-primary/30 bg-primary/10 text-primary"
          >
            Leçon {position}
          </Badge>
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden />
            {lesson.estimatedMinutes} min
          </Badge>
          {lesson.completed && (
            <Badge
              variant="outline"
              className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
            >
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              Terminée
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Progress
          value={course.pct}
          className="h-1.5"
          aria-label={`Progression du cours : ${course.pct} %`}
        />
        <div className="mt-1 text-right text-[11px] text-muted-foreground">
          {course.completedLessons}/{course.totalLessons} leçons ({course.pct}%)
        </div>
      </CardContent>
    </Card>
  );
}
