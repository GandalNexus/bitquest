import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function StudioChaptersPage() {
  const chapters = await db.chapter.findMany({
    orderBy: [{ course: { order: "asc" } }, { order: "asc" }],
    include: {
      course: { select: { id: true, slug: true, title: true } },
      _count: { select: { lessons: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Chapitres</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue à plat de tous les chapitres. Clique pour éditer le contenu et ses leçons.
        </p>
      </header>

      {chapters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <BookOpen className="h-8 w-8 opacity-40" aria-hidden />
            <p className="text-sm">
              Aucun chapitre pour l&apos;instant. Crée-les depuis un cours.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-1">
          {chapters.map((ch) => (
            <li key={ch.id}>
              <Link
                href={`/admin/chapters/${ch.id}`}
                className="flex items-center gap-3 rounded-md border bg-background/60 p-3 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                  {ch.order}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{ch.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {ch.course.title} · {ch.summary}
                  </div>
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
    </div>
  );
}
