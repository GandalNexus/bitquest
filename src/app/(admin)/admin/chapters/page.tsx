import { ContentLink as Link } from "@/components/admin/content-link";
import { BookOpen, ChevronRight, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CrudSearchBar } from "@/components/admin/crud-search-bar";

export const dynamic = "force-dynamic";

/**
 * Liste à plat de tous les chapitres (admin + studio).
 * Partagée via re-export côté `/studio/chapters` — `ContentLink`
 * réécrit les hrefs `/admin/*` vers `/studio/*` quand l'URL courante
 * est sous `/studio`.
 */
export default async function AdminChaptersPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const query = (sp.q ?? "").trim().slice(0, 60);

  const where = query.length > 0
    ? {
        OR: [
          { title: { contains: query, mode: "insensitive" as const } },
          { summary: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const chapters = await db.chapter.findMany({
    where,
    orderBy: [{ course: { order: "asc" } }, { order: "asc" }],
    include: {
      course: { select: { id: true, slug: true, title: true } },
      _count: { select: { lessons: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Chapitres</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {chapters.length} chapitre{chapters.length > 1 ? "s" : ""}
            {query ? ` · recherche « ${query} »` : ""}
            {" · Clique pour éditer le contenu et ses leçons."}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/chapters/new">
            <Plus className="h-4 w-4" aria-hidden />
            Nouveau chapitre
          </Link>
        </Button>
      </header>

      <CrudSearchBar
        initialQuery={query}
        placeholder="Titre ou résumé du chapitre…"
        ariaLabel="Rechercher un chapitre"
      />

      {chapters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <BookOpen className="h-8 w-8 opacity-40" aria-hidden />
            <p className="text-sm">
              {query ? `Aucun chapitre ne matche « ${query} ».` : "Aucun chapitre pour l'instant."}
            </p>
            {!query && (
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/chapters/new">Créer le premier chapitre</Link>
              </Button>
            )}
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
