import { ContentLink as Link } from "@/components/admin/content-link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewLessonForm } from "./new-lesson-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nouvelle leçon — Admin BitQuest" };

export default async function NewLessonPage({
  searchParams,
}: {
  searchParams?: Promise<{ chapterId?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const rows = await db.chapter.findMany({
    orderBy: [{ course: { order: "asc" } }, { order: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      course: { select: { title: true } },
    },
  });
  const chapters = rows.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    courseTitle: c.course.title,
  }));
  const initialChapterId =
    sp.chapterId && chapters.some((c) => c.id === sp.chapterId) ? sp.chapterId : "";

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/lessons">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour à la liste
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle leçon</CardTitle>
          <CardDescription>
            Choisis un chapitre parent, renseigne les métadonnées. Le contenu Markdown
            s&apos;édite ensuite via le lien « Éditer ».
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chapters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun chapitre pour l&apos;instant. Crée d&apos;abord un chapitre.
            </p>
          ) : (
            <NewLessonForm chapters={chapters} initialChapterId={initialChapterId} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
