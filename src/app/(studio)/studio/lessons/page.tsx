import Link from "next/link";
import { CheckCircle2, Clock, PenSquare } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function StudioLessonsPage() {
  const lessons = await db.lesson.findMany({
    orderBy: [{ chapter: { course: { order: "asc" } } }, { chapter: { order: "asc" } }, { order: "asc" }],
    include: {
      chapter: {
        select: {
          id: true,
          title: true,
          course: { select: { id: true, slug: true, title: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Leçons</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue à plat de toutes les leçons. Clique pour éditer le Markdown.
        </p>
      </header>

      {lessons.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <PenSquare className="h-8 w-8 opacity-40" aria-hidden />
            <p className="text-sm">Aucune leçon pour l&apos;instant.</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-1">
          {lessons.map((l) => {
            const published = l.publishedAt !== null;
            return (
              <li key={l.id}>
                <Link
                  href={`/admin/lessons/${l.id}`}
                  className="flex items-center gap-3 rounded-md border bg-background/60 p-3 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{l.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {l.chapter.course.title} · {l.chapter.title}
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" aria-hidden />
                    {l.estimatedMinutes} min
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      published
                        ? "shrink-0 gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
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
    </div>
  );
}
