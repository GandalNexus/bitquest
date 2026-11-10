import Link from "next/link";
import { Flame, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { todayUtc } from "@/lib/bitquest/challenges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

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

export default async function AdminChallengesPage() {
  const today = todayUtc();
  const challenges = await db.dailyChallenge.findMany({
    orderBy: { date: "desc" },
    include: { _count: { select: { completions: true } } },
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Défis du jour</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Un défi pédagogique léger par journée UTC. La tuile côté dashboard affiche
            automatiquement celui du jour.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/challenges/new">
            <Plus className="h-4 w-4" aria-hidden />
            Nouveau défi
          </Link>
        </Button>
      </header>

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
    </div>
  );
}
