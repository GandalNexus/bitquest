import { ContentLink as Link } from "@/components/admin/content-link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewChapterForm } from "./new-chapter-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nouveau chapitre — Admin BitQuest" };

export default async function NewChapterPage({
  searchParams,
}: {
  searchParams?: Promise<{ courseId?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const courses = await db.course.findMany({
    orderBy: { order: "asc" },
    select: { id: true, title: true, slug: true },
  });
  const initialCourseId =
    sp.courseId && courses.some((c) => c.id === sp.courseId) ? sp.courseId : "";

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/chapters">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour à la liste
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Nouveau chapitre</CardTitle>
          <CardDescription>
            Choisis un cours parent, puis renseigne les métadonnées. Les leçons s&apos;ajoutent
            ensuite depuis la page du chapitre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun cours pour l&apos;instant. Crée d&apos;abord un cours.
            </p>
          ) : (
            <NewChapterForm courses={courses} initialCourseId={initialCourseId} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
