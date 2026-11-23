import Link from "next/link";
import { ChevronLeft, ChevronRight, Flame, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { todayUtc } from "@/lib/bitquest/challenges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CrudSearchBar } from "@/components/admin/crud-search-bar";
import { requireAdminOrDenied } from "../_require-admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function classify(date: string, today: string): "past" | "today" | "future" {
  if (date === today) return "today";
  return date < today ? "past" : "future";
}

const classifyStyles: Record<"past" | "today" | "future", string> = {
  past: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
  today: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  future: "border-primary/40 bg-primary/10 text-primary",
};

const classifyLabels: Record<"past" | "today" | "future", string> = {
  past: "Passé",
  today: "Aujourd'hui",
  future: "À venir",
};

export default async function AdminChallengesPage({
  searchParams,
}: {
  searchParams?: Promise<{ when?: string; page?: string; q?: string }>;
}) {
  const gate = await requireAdminOrDenied();
  if (!gate.ok) return gate.element;

  const sp = (await searchParams) ?? {};
  const whenFilter =
    sp.when === "past" || sp.when === "today" || sp.when === "future" ? sp.when : null;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const query = (sp.q ?? "").trim().slice(0, 60);

  const today = todayUtc();
  const dateClause = (() => {
    if (whenFilter === "today") return { date: today };
    if (whenFilter === "past") return { date: { lt: today } };
    if (whenFilter === "future") return { date: { gt: today } };
    return null;
  })();
  const searchClause = query.length > 0
    ? {
        OR: [
          { title: { contains: query, mode: "insensitive" as const } },
          { prompt: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : null;
  const andClauses = [dateClause, searchClause].filter(
    (c): c is NonNullable<typeof c> => c !== null,
  );
  const whereFilter = andClauses.length > 0 ? { AND: andClauses } : undefined;

  const [challenges, totalCount] = await Promise.all([
    db.dailyChallenge.findMany({
      where: whereFilter,
      orderBy: { date: "desc" },
      include: { _count: { select: { completions: true } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.dailyChallenge.count({ where: whereFilter }),
  ]);
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const qs = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string | null> = {
      when: whenFilter,
      q: query || null,
      page: null,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    return params.toString();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Défis du jour</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCount} défi{totalCount > 1 ? "s" : ""}
            {whenFilter ? ` · ${classifyLabels[whenFilter]}` : ""}
            {query ? ` · recherche « ${query} »` : ""}
            {pageCount > 1 ? ` · page ${page}/${pageCount}` : ""}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/challenges/new">
            <Plus className="h-4 w-4" aria-hidden />
            Nouveau défi
          </Link>
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer par période">
        <FilterChip href={`/admin/challenges?${qs({ when: null })}`} active={whenFilter === null} label="Tous" />
        <FilterChip href={`/admin/challenges?${qs({ when: "past" })}`} active={whenFilter === "past"} label="Passés" />
        <FilterChip href={`/admin/challenges?${qs({ when: "today" })}`} active={whenFilter === "today"} label="Aujourd'hui" />
        <FilterChip href={`/admin/challenges?${qs({ when: "future" })}`} active={whenFilter === "future"} label="À venir" />
      </div>

      <CrudSearchBar
        initialQuery={query}
        placeholder="Titre ou prompt du défi…"
        ariaLabel="Rechercher un défi du jour"
      />

      {challenges.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <Flame className="h-8 w-8 opacity-40" aria-hidden />
            <p className="text-sm">Aucun défi pour l&apos;instant.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/challenges/new">Créer le premier défi</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {challenges.map((c) => {
            const cls = classify(c.date, today);
            return (
              <li key={c.id}>
                <Link
                  href={`/admin/challenges/${c.id}`}
                  className="flex items-center gap-3 rounded-md border bg-background/60 p-3 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <code className="shrink-0 rounded bg-muted px-2 py-1 font-mono text-xs">
                    {c.date}
                  </code>
                  <Badge variant="outline" className={classifyStyles[cls]}>
                    {classifyLabels[cls]}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.prompt}</div>
                  </div>
                  <div className="hidden shrink-0 items-center gap-3 text-xs text-muted-foreground sm:flex">
                    <span>+{c.xpReward} XP</span>
                    <span>+{c.satsReward} sats</span>
                    <span>
                      {c._count.completions} validation
                      {c._count.completions > 1 ? "s" : ""}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
          <span>
            Page {page} sur {pageCount}
          </span>
          <div className="flex items-center gap-1">
            {page > 1 ? (
              <Link
                href={`/admin/challenges?${qs({ page: String(page - 1) })}`}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:border-primary/40 hover:text-foreground"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                Précédente
              </Link>
            ) : (
              <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border px-2 py-1 text-muted-foreground/50">
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                Précédente
              </span>
            )}
            {page < pageCount ? (
              <Link
                href={`/admin/challenges?${qs({ page: String(page + 1) })}`}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:border-primary/40 hover:text-foreground"
              >
                Suivante
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ) : (
              <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border px-2 py-1 text-muted-foreground/50">
                Suivante
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
