import { ContentLink as Link } from "@/components/admin/content-link";
import { ChevronRight, Coins, Map, Plus, Star } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const TRACKS = ["INITIATION", "INTERMEDIATE", "ADVANCED", "SPECIAL"] as const;

const trackStyles: Record<string, { label: string; className: string }> = {
  INITIATION: { label: "Initiation", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" },
  INTERMEDIATE: { label: "Intermédiaire", className: "border-amber-500/40 bg-amber-500/10 text-amber-500" },
  ADVANCED: { label: "Avancé", className: "border-rose-500/40 bg-rose-500/10 text-rose-500" },
  SPECIAL: { label: "Événement", className: "border-violet-500/40 bg-violet-500/10 text-violet-500" },
};

export default async function AdminQuestsPage() {
  const quests = await db.quest.findMany({
    orderBy: [{ track: "asc" }, { order: "asc" }],
    include: {
      _count: { select: { progress: true, quizQuestions: true } },
    },
  });

  const grouped = TRACKS.map((track) => ({
    track,
    quests: quests.filter((q) => q.track === track),
  })).filter((g) => g.quests.length > 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Quêtes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Créer une coquille de quête ou éditer les métadonnées, la théorie,
            le quiz et la configuration mission.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/quests/new">
            <Plus className="h-4 w-4" aria-hidden />
            Nouvelle quête
          </Link>
        </Button>
      </header>

      {grouped.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <Map className="h-8 w-8 opacity-40" aria-hidden />
            <p className="text-sm">Aucune quête pour l&apos;instant.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/quests/new">Créer la première quête</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ track, quests: ts }) => {
            const style = trackStyles[track];
            return (
              <section key={track}>
                <div className="mb-3 flex items-center gap-3">
                  <Badge variant="outline" className={style.className}>
                    {style.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {ts.length} quête{ts.length > 1 ? "s" : ""}
                  </span>
                  <div className="h-px flex-1 bg-border" aria-hidden />
                </div>
                <ul className="space-y-1">
                  {ts.map((q) => (
                    <li key={q.id}>
                      <Link
                        href={`/admin/quests/${q.code}`}
                        className="flex items-center gap-3 rounded-md border bg-background/60 p-3 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
                      >
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                          {q.order}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="truncate font-medium">{q.title}</span>
                            <code className="hidden shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
                              {q.code}
                            </code>
                          </div>
                          <div className="truncate text-xs text-muted-foreground">{q.subtitle}</div>
                        </div>
                        <div className="hidden shrink-0 items-center gap-3 text-xs text-muted-foreground sm:flex">
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3 w-3" aria-hidden />
                            {q.xpReward} XP
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Coins className="h-3 w-3" aria-hidden />
                            {q.satsReward}
                          </span>
                          <span>Nv. {q.requiredLevel}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Hors scope de cette page</CardTitle>
          <CardDescription>
            Éditeur de sections théoriques, builder de quiz (MCQ / VRAI-FAUX), et configurateur
            de mission (8 types BitLab) arrivent en Phase 2.6b. En attendant, modifier
            <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[10px]">src/lib/seed-data.ts</code>
            puis relancer <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">npm run db:seed</code>.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
