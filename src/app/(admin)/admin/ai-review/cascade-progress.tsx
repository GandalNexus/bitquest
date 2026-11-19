import { ContentLink as Link } from "@/components/admin/content-link";
import { ArrowRight, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LessonDraft } from "@/lib/ai/schemas";

/**
 * Agrège les cascades « actives » visibles depuis AIDraft :
 *   - On regarde tous les chapitres publiés qui ont un AIDraft CHAPTER
 *     APPROVED avec un `lessonsPlan`.
 *   - Pour chaque, on compte les leçons publiées vs le plan.
 *   - On affiche les cascades incomplètes (progression < 100%).
 */
export async function CascadeProgressSection() {
  const chapterDrafts = await db.aIDraft.findMany({
    where: {
      type: "CHAPTER",
      status: "APPROVED",
      publishedId: { not: null },
    },
    orderBy: { reviewedAt: "desc" },
    take: 20,
    select: { id: true, payload: true, publishedId: true, reviewedAt: true },
  });

  if (chapterDrafts.length === 0) return null;

  const chapterIds = chapterDrafts
    .map((d) => d.publishedId)
    .filter((id): id is string => id !== null);

  const [chapters, lessonDrafts] = await Promise.all([
    db.chapter.findMany({
      where: { id: { in: chapterIds } },
      include: {
        course: { select: { title: true, slug: true } },
        lessons: { select: { title: true, publishedAt: true } },
      },
    }),
    db.aIDraft.findMany({
      where: { type: "LESSON", status: { in: ["PENDING", "APPROVED"] } },
      select: { payload: true, status: true },
    }),
  ]);

  const chapterMap = new Map(chapters.map((c) => [c.id, c]));

  // Compte des drafts PENDING par chapter slug (pour "en review" dans la progress).
  const draftsBySlug = new Map<string, { pending: number; approved: number }>();
  for (const d of lessonDrafts) {
    try {
      const p = JSON.parse(d.payload) as Partial<LessonDraft>;
      if (!p.chapterSlug) continue;
      const curr = draftsBySlug.get(p.chapterSlug) ?? { pending: 0, approved: 0 };
      if (d.status === "PENDING") curr.pending++;
      else if (d.status === "APPROVED") curr.approved++;
      draftsBySlug.set(p.chapterSlug, curr);
    } catch {
      // ignore
    }
  }

  const rows = chapterDrafts
    .map((d) => {
      const chapter = d.publishedId ? chapterMap.get(d.publishedId) : null;
      if (!chapter) return null;
      let plan: string[] = [];
      try {
        const parsed = JSON.parse(d.payload) as { lessonsPlan?: unknown };
        if (Array.isArray(parsed.lessonsPlan)) {
          plan = parsed.lessonsPlan.filter((t): t is string => typeof t === "string");
        }
      } catch {
        // ignore
      }
      if (plan.length === 0) return null;
      const published = chapter.lessons.filter((l) => l.publishedAt !== null).length;
      const drafts = draftsBySlug.get(chapter.slug) ?? { pending: 0, approved: 0 };
      const total = plan.length;
      const done = Math.min(published, total);
      if (done === total && drafts.pending === 0) return null; // 100% done
      const progressPct = Math.round((done / total) * 100);
      return {
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        courseTitle: chapter.course.title,
        total,
        done,
        pending: drafts.pending,
        progressPct,
        reviewedAt: d.reviewedAt,
      };
    })
    .filter(<T,>(r: T | null): r is T => r !== null)
    .sort((a, b) => a.progressPct - b.progressPct); // least-complete first

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Cascades en cours ({rows.length})
        </CardTitle>
        <CardDescription>
          Chapitres dont le plan IA n&apos;est pas encore entièrement généré ou publié.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <Link
            key={r.chapterId}
            href={`/admin/chapters/${r.chapterId}`}
            className="flex items-center gap-3 rounded-md border p-3 text-sm transition-colors hover:bg-muted"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.chapterTitle}</span>
                <span className="text-xs text-muted-foreground">· {r.courseTitle}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${r.progressPct}%` }}
                  />
                </div>
                <span className="tabular-nums">
                  {r.done}/{r.total} publiée{r.done > 1 ? "s" : ""}
                  {r.pending > 0 && ` · ${r.pending} en review`}
                </span>
              </div>
            </div>
            {r.pending > 0 && (
              <Badge
                variant="outline"
                className="shrink-0 border-amber-500/40 bg-amber-500/10 text-amber-500"
              >
                {r.pending} ⏳
              </Badge>
            )}
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
