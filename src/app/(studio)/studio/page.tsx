import Link from "next/link";
import {
  BookOpen,
  GraduationCap,
  Map,
  PenSquare,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface StatRow {
  label: string;
  value: number;
  icon: LucideIcon;
  hint?: string;
}

export const dynamic = "force-dynamic";

export default async function StudioHomePage() {
  const [
    totalCourses,
    publishedCourses,
    totalChapters,
    totalLessons,
    publishedLessons,
    totalQuests,
  ] = await Promise.all([
    db.course.count(),
    db.course.count({ where: { publishedAt: { not: null } } }),
    db.chapter.count(),
    db.lesson.count(),
    db.lesson.count({ where: { publishedAt: { not: null } } }),
    db.quest.count(),
  ]);

  const stats: StatRow[] = [
    {
      label: "Cours",
      value: totalCourses,
      icon: GraduationCap,
      hint: `${publishedCourses} publié${publishedCourses > 1 ? "s" : ""} · ${totalCourses - publishedCourses} brouillon${totalCourses - publishedCourses > 1 ? "s" : ""}`,
    },
    {
      label: "Chapitres",
      value: totalChapters,
      icon: BookOpen,
      hint: "Regroupent les leçons d'un cours",
    },
    {
      label: "Leçons",
      value: totalLessons,
      icon: PenSquare,
      hint: `${publishedLessons} publiée${publishedLessons > 1 ? "s" : ""} · ${totalLessons - publishedLessons} brouillon${totalLessons - publishedLessons > 1 ? "s" : ""}`,
    },
    {
      label: "Quêtes",
      value: totalQuests,
      icon: Map,
      hint: "Théorie + quiz + mission BitLab",
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Studio éditorial</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crée et publie les cours de l&apos;Académie et les quêtes pédagogiques BitQuest.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              Démarrer un parcours
            </CardTitle>
            <CardDescription>
              Crée un cours, structure-le en chapitres, écris les leçons, puis publie.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/studio/courses">
                <GraduationCap className="h-4 w-4" aria-hidden />
                Gérer les cours
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/studio/chapters">
                <BookOpen className="h-4 w-4" aria-hidden />
                Chapitres
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/studio/lessons">
                <PenSquare className="h-4 w-4" aria-hidden />
                Leçons
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Map className="h-4 w-4 text-primary" aria-hidden />
              Quêtes pédagogiques
            </CardTitle>
            <CardDescription>
              Métadonnées, théorie, quiz et missions BitLab des quêtes existantes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/studio/quests">Ouvrir les quêtes</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatCard({ stat }: { stat: StatRow }) {
  const Icon = stat.icon;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">
          {stat.label}
        </CardDescription>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </CardHeader>
      <CardContent>
        <div className="font-display text-3xl font-bold">{stat.value.toLocaleString("fr-FR")}</div>
        {stat.hint && <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>}
      </CardContent>
    </Card>
  );
}
