import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CourseForm } from "../course-form";

export const dynamic = "force-dynamic";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const course = await db.course.findUnique({
    where: { id },
    include: { _count: { select: { chapters: true } } },
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
      <Card>
        <CardHeader>
          <CardTitle>Éditer : {course.title}</CardTitle>
          <CardDescription>
            {course._count.chapters} chapitre{course._count.chapters > 1 ? "s" : ""} — pour les
            éditer, passer par les sous-sections (à venir en Phase 2.4b).
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
    </div>
  );
}
