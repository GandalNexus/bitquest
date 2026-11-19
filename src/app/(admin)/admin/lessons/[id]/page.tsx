import { ContentLink as Link } from "@/components/admin/content-link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LessonForm } from "./lesson-form";
import { LessonEnrichPanel } from "./enrich-panel";
import { ContentBreadcrumbs } from "@/components/admin/content-breadcrumbs";

export const dynamic = "force-dynamic";

export default async function EditLessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lesson = await db.lesson.findUnique({
    where: { id },
    include: {
      chapter: {
        select: {
          id: true,
          slug: true,
          title: true,
          course: { select: { id: true, slug: true, title: true } },
        },
      },
    },
  });
  if (!lesson) notFound();

  return (
    <div className="space-y-6">
      <ContentBreadcrumbs
        items={[
          { label: "Cours", href: "/admin/courses" },
          {
            label: lesson.chapter.course.title,
            href: `/admin/courses/${lesson.chapter.course.id}`,
          },
          {
            label: lesson.chapter.title,
            href: `/admin/chapters/${lesson.chapter.id}`,
          },
          { label: "Leçons", href: "/admin/lessons" },
          { label: lesson.title },
        ]}
      />
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/admin/chapters/${lesson.chapter.id}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour au chapitre « {lesson.chapter.title} »
        </Link>
      </Button>

      <LessonEnrichPanel
        lessonId={lesson.id}
        lessonTitle={lesson.title}
        chapterTitle={lesson.chapter.title}
        courseTitle={lesson.chapter.course.title}
      />

      <Card>
        <CardHeader>
          <CardTitle>Éditer la leçon : {lesson.title}</CardTitle>
          <CardDescription>
            {lesson.chapter.course.title} / {lesson.chapter.title}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LessonForm
            initial={{
              id: lesson.id,
              slug: lesson.slug,
              title: lesson.title,
              summary: lesson.summary,
              content: lesson.content,
              estimatedMinutes: lesson.estimatedMinutes,
              order: lesson.order,
              publishedAt: lesson.publishedAt?.toISOString() ?? null,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
