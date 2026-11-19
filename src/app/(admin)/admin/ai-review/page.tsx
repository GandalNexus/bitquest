import { ContentLink as Link } from "@/components/admin/content-link";
import { Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AIReviewPanel } from "./ai-review-panel";

export const dynamic = "force-dynamic";

/**
 * Admin — Review IA v2.
 *
 * Interface brief-driven : mode + sujet + options → Claude → draft.
 * Les cours sont chargés server-side pour alimenter le picker.
 */
export default async function AIReviewPage() {
  const [pending, history, courses] = await Promise.all([
    db.aIDraft.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.aIDraft.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] } },
      orderBy: { reviewedAt: "desc" },
      take: 10,
    }),
    db.course.findMany({
      orderBy: [{ order: "asc" }, { title: "asc" }],
      select: {
        slug: true,
        title: true,
        publishedAt: true,
        chapters: {
          orderBy: { order: "asc" },
          select: { slug: true, title: true },
        },
      },
    }),
  ]);

  const serializableDrafts = [...pending, ...history].map((d) => ({
    id: d.id,
    type: d.type,
    status: d.status,
    payload: d.payload,
    aiModel: d.aiModel,
    rejectReason: d.rejectReason,
    publishedId: d.publishedId,
    createdAt: d.createdAt.toISOString(),
    reviewedAt: d.reviewedAt?.toISOString() ?? null,
    tokensInput: d.tokensInput,
    tokensOutput: d.tokensOutput,
  }));

  const serializableCourses = courses.map((c) => ({
    slug: c.slug,
    title: c.title,
    published: c.publishedAt !== null,
    chapters: c.chapters,
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Sparkles className="h-6 w-6 text-primary" />
            Review IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Génère du contenu pédagogique guidé — Claude analyse ton brief et la taxonomie
            existante, tu valides avant publication.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-500/40 text-amber-500">
            {pending.length} en attente
          </Badge>
          <Link
            href="/admin/ai-usage"
            className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            Usage & scheduler →
          </Link>
        </div>
      </header>

      {pending.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aucun brouillon en attente</CardTitle>
            <CardDescription>
              Décris ton idée ci-dessous. Claude Opus 4.7 analyse la taxonomie BitQuest
              (cours, chapitres, leçons existants) et génère un contenu structuré prêt à relire.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Requiert <code>ANTHROPIC_API_KEY</code> + <code>AI_GENERATION_ENABLED=1</code>.
            </p>
          </CardContent>
        </Card>
      )}

      <AIReviewPanel drafts={serializableDrafts} courses={serializableCourses} />
    </div>
  );
}
