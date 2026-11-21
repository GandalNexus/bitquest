import { ContentLink as Link } from "@/components/admin/content-link";
import { BookOpen, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrudSearchBar } from "@/components/admin/crud-search-bar";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; page?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const query = (sp.q ?? "").trim().slice(0, 60);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const where = query.length > 0
    ? {
        OR: [
          { title: { contains: query, mode: "insensitive" as const } },
          { subtitle: { contains: query, mode: "insensitive" as const } },
          { slug: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const skip = (page - 1) * PAGE_SIZE;
  const [courses, total] = await Promise.all([
    db.course.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { chapters: true } },
        chapters: { select: { _count: { select: { lessons: true } } } },
      },
      skip,
      take: PAGE_SIZE,
    }),
    db.course.count({ where }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Cours</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} cours{query ? ` · recherche « ${query} »` : ""}
            {pageCount > 1 ? ` · page ${page}/${pageCount}` : ""}
            {" · Créer, modifier et publier les parcours Académie."}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/courses/new">
            <Plus className="h-4 w-4" aria-hidden />
            Nouveau cours
          </Link>
        </Button>
      </header>

      <CrudSearchBar
        initialQuery={query}
        placeholder="Titre, slug ou sous-titre…"
        ariaLabel="Rechercher un cours"
      />

      {courses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <BookOpen className="h-8 w-8 opacity-40" aria-hidden />
            <p className="text-sm">
              {query ? `Aucun cours ne matche « ${query} ».` : "Aucun cours pour l'instant."}
            </p>
            {!query && (
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/courses/new">Créer le premier cours</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {courses.map((course) => {
            const totalLessons = course.chapters.reduce((acc, ch) => acc + ch._count.lessons, 0);
            const published = course.publishedAt !== null;
            return (
              <li key={course.id}>
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{course.title}</CardTitle>
                      <Badge
                        variant="outline"
                        className={
                          published
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                            : "border-amber-500/40 bg-amber-500/10 text-amber-500"
                        }
                      >
                        {published ? "Publié" : "Brouillon"}
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2">{course.subtitle}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>
                        <code className="rounded bg-muted px-1 py-0.5 font-mono">
                          /{course.slug}
                        </code>
                      </span>
                      <span>Ordre {course.order}</span>
                      <span>
                        {course._count.chapters} chapitre{course._count.chapters > 1 ? "s" : ""} ·{" "}
                        {totalLessons} leçon{totalLessons > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/courses/${course.id}`}>Éditer</Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/academy/${course.slug}`} target="_blank">
                          Voir en public
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {pageCount > 1 && (
        <Pagination page={page} pageCount={pageCount} query={query} />
      )}
    </div>
  );
}

function Pagination({
  page,
  pageCount,
  query,
}: {
  page: number;
  pageCount: number;
  query: string;
}) {
  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/admin/courses?${qs}` : "/admin/courses";
  };
  return (
    <div className="flex items-center justify-between rounded-md border px-4 py-2 text-xs text-muted-foreground">
      <span>Page {page} sur {pageCount}</span>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link
            href={buildHref(page - 1)}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:border-primary/40 hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Précédente
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 opacity-50">
            <ChevronLeft className="h-3.5 w-3.5" />
            Précédente
          </span>
        )}
        {page < pageCount ? (
          <Link
            href={buildHref(page + 1)}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:border-primary/40 hover:text-foreground"
          >
            Suivante
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 opacity-50">
            Suivante
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </div>
  );
}
