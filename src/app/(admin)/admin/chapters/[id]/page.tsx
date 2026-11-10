import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, CheckCircle2, Clock, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChapterForm } from "../chapter-form";
import { LessonCreateForm } from "./lesson-create-form";

export const dynamic = "force-dynamic";

export default async function EditChapterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const chapter = await db.chapter.findUnique({
    where: { id },
    include: {
      course: { select: { id: true, slug: true, title: true } },
      lessons: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          estimatedMinutes: true,
          order: true,
          publishedAt: true,
        },
      },
    },
  });
  if (!chapter) notFound();

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/admin/courses/${chapter.course.id}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour au cours « {chapter.course.title} »
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Éditer le chapitre : {chapter.title}</CardTitle>
          <CardDescription>
            {chapter.lessons.length} leçon{chapter.lessons.length > 1 ? "s" : ""} rattachée
            {chapter.lessons.length > 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChapterForm
            mode="edit"
            initial={{
              id: chapter.id,
              slug: chapter.slug,
              title: chapter.title,
              summary: chapter.summary,
              order: chapter.order,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" aria-hidden />
            Leçons ({chapter.lessons.length})
          </CardTitle>
          <CardDescription>
            Markdown pur, ordonné par <code>order</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {chapter.lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune leçon.</p>
          ) : (
            <ul className="space-y-1">
              {chapter.lessons.map((l, i) => {
                const published = l.publishedAt !== null;
                return (
                  <li key={l.id}>
                    <Link
                      href={`/admin/lessons/${l.id}`}
                      className="flex items-center gap-3 rounded-md border bg-background/60 p-3 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
                    >
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{l.title}</div>
                        <div className="truncate text-xs text-muted-foreground">{l.summary}</div>
                      </div>
                      <Badge variant="outline" className="shrink-0 gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" aria-hidden />
                        {l.estimatedMinutes} min
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          published
                            ? "shrink-0 border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                            : "shrink-0 border-amber-500/40 bg-amber-500/10 text-amber-500"
                        }
                      >
                        {published ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" aria-hidden /> Publiée
                          </>
                        ) : (
                          "Brouillon"
                        )}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-primary" aria-hidden />
            Ajouter une leçon
          </CardTitle>
          <CardDescription>
            Le contenu Markdown s&apos;édite ensuite via le lien « Éditer ».
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LessonCreateForm chapterId={chapter.id} nextOrder={chapter.lessons.length + 1} />
        </CardContent>
      </Card>
    </div>
  );
}
