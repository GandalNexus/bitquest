import { ContentLink as Link } from "@/components/admin/content-link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LessonForm } from "./lesson-form";

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
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/admin/chapters/${lesson.chapter.id}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour au chapitre « {lesson.chapter.title} »
        </Link>
      </Button>

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
