import { ContentLink as Link } from "@/components/admin/content-link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, ChevronRight, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CourseForm } from "../course-form";
import { ChapterForm } from "../../chapters/chapter-form";

export const dynamic = "force-dynamic";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const course = await db.course.findUnique({
    where: { id },
    include: {
      chapters: {
        orderBy: { order: "asc" },
        include: { _count: { select: { lessons: true } } },
      },
    },
  });
  if (!course) notFound();

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/courses">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour à la liste
        </Link>
      </Button>

      {/* === Formulaire du cours === */}
      <Card>
        <CardHeader>
          <CardTitle>Éditer : {course.title}</CardTitle>
          <CardDescription>
            {course.chapters.length} chapitre{course.chapters.length > 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CourseForm
            mode="edit"
            initial={{
              id: course.id,
              slug: course.slug,
              title: course.title,
              subtitle: course.subtitle,
              description: course.description,
              coverIcon: course.coverIcon,
              order: course.order,
              publishedAt: course.publishedAt?.toISOString() ?? null,
            }}
          />
        </CardContent>
      </Card>

      {/* === Chapitres du cours === */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" aria-hidden />
            Chapitres ({course.chapters.length})
          </CardTitle>
          <CardDescription>Clique sur un chapitre pour éditer son contenu et ses leçons.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {course.chapters.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun chapitre pour l&apos;instant.</p>
          ) : (
            <ul className="space-y-1">
              {course.chapters.map((ch, i) => (
                <li key={ch.id}>
                  <Link
                    href={`/admin/chapters/${ch.id}`}
                    className="flex items-center gap-3 rounded-md border bg-background/60 p-3 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{ch.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{ch.summary}</div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {ch._count.lessons} leçon{ch._count.lessons > 1 ? "s" : ""}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* === Ajouter un chapitre === */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-primary" aria-hidden />
            Ajouter un chapitre
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChapterForm
            mode="create"
            courseId={course.id}
            compact
            initial={{ slug: "", title: "", summary: "", order: course.chapters.length + 1 }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
