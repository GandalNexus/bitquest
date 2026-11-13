import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function StudioCoursesPage() {
  const courses = await db.course.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { chapters: true } },
      chapters: { include: { _count: { select: { lessons: true } } } },
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Cours</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Créer, modifier et publier les parcours Académie.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/courses/new">
            <Plus className="h-4 w-4" aria-hidden />
            Nouveau cours
          </Link>
        </Button>
      </header>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <BookOpen className="h-8 w-8 opacity-40" aria-hidden />
            <p className="text-sm">Aucun cours pour l&apos;instant.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/courses/new">Créer le premier cours</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {courses.map((course) => {
            const totalLessons = course.chapters.reduce((acc, ch) => acc + ch._count.lessons, 0);
            const published = course.publishedAt !== null;
            return (
              <li key={course.id}>
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{course.title}</CardTitle>
                      <Badge
                        variant="outline"
                        className={
                          published
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                            : "border-amber-500/40 bg-amber-500/10 text-amber-500"
                        }
                      >
                        {published ? "Publié" : "Brouillon"}
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2">{course.subtitle}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>
                        <code className="rounded bg-muted px-1 py-0.5 font-mono">
                          /{course.slug}
                        </code>
                      </span>
                      <span>Ordre {course.order}</span>
                      <span>
                        {course._count.chapters} chapitre{course._count.chapters > 1 ? "s" : ""} ·{" "}
                        {totalLessons} leçon{totalLessons > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/courses/${course.id}`}>Éditer</Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/academy/${course.slug}`} target="_blank">
                          Voir en public
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
