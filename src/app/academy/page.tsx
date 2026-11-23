"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  GraduationCap,
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
import { api } from "@/lib/bitquest/client";
import { EmptyState, ErrorState, LoadingState } from "@/components/bitquest/ui-bits";

export default function AcademyCataloguePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["academy", "courses"],
    queryFn: api.academyCourses,
    retry: 1,
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <PageHeader />

      {isLoading ? (
        <LoadingState label="Chargement du catalogue…" />
      ) : isError ? (
        <ErrorState
          message="Impossible de charger les cours. Vérifie ta connexion."
          onRetry={() => refetch()}
        />
      ) : !data?.courses.length ? (
        <EmptyState
          icon={BookOpen}
          title="Aucun cours publié pour l'instant"
          sub="Les premiers cours arrivent très bientôt — reviens régulièrement."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.courses.map((course) => (
            <li key={course.id}>
              <CourseCard course={course} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <header className="mb-8 space-y-3">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour à l&apos;app
        </Link>
      </Button>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <GraduationCap className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Académie BitQuest
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Des parcours structurés pour approfondir Bitcoin : chaque cours enchaîne des
            chapitres et des leçons, à ton rythme. Complémentaire aux quêtes gamifiées.
          </p>
        </div>
      </div>
    </header>
  );
}

function CourseCard({
  course,
}: {
  course: {
    id: string;
    slug: string;
    title: string;
    subtitle: string;
    description: string;
    totalLessons: number;
    totalChapters: number;
    completedLessons: number;
    pct: number;
  };
}) {
  const isComplete = course.totalLessons > 0 && course.completedLessons === course.totalLessons;
  const started = course.completedLessons > 0;
  return (
    <Card className="h-full rounded-xl">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">{course.title}</CardTitle>
          {isComplete ? (
            <Badge
              variant="outline"
              className="shrink-0 border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
            >
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              Terminé
            </Badge>
          ) : started ? (
            <Badge
              variant="outline"
              className="shrink-0 border-primary/40 bg-primary/10 text-primary"
            >
              En cours
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0">
              Nouveau
            </Badge>
          )}
        </div>
        <CardDescription className="line-clamp-2">{course.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="line-clamp-3 text-sm text-muted-foreground">{course.description}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {course.totalChapters} chapitre{course.totalChapters > 1 ? "s" : ""} ·{" "}
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
        <Button asChild className="w-full">
          <Link href={`/academy/${course.slug}`}>
            {isComplete ? "Revoir le cours" : started ? "Reprendre" : "Commencer"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

