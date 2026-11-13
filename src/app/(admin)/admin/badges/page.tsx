import Link from "next/link";
import { Plus, Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminOrDenied } from "../_require-admin";

export const dynamic = "force-dynamic";

const rarityStyles: Record<string, string> = {
  COMMON: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
  RARE: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  EPIC: "border-violet-500/40 bg-violet-500/10 text-violet-500",
};

export default async function AdminBadgesPage() {
  const gate = await requireAdminOrDenied();
  if (!gate.ok) return gate.element;

  const badges = await db.badge.findMany({
    orderBy: [{ rarity: "asc" }, { name: "asc" }],
    include: { _count: { select: { users: true } } },
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Badges</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {badges.length} badge{badges.length > 1 ? "s" : ""} configuré
            {badges.length > 1 ? "s" : ""} · attribués automatiquement par le moteur
            <code className="ml-1 rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
              evaluateBadges()
            </code>
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/badges/new">
            <Plus className="h-4 w-4" aria-hidden />
            Nouveau badge
          </Link>
        </Button>
      </header>

      {badges.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <Trophy className="h-8 w-8 opacity-40" aria-hidden />
            <p className="text-sm">Aucun badge pour l&apos;instant.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/badges/new">Créer le premier badge</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {badges.map((b) => (
            <li key={b.id}>
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base">{b.name}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {b.description}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className={rarityStyles[b.rarity] ?? rarityStyles.COMMON}
                    >
                      {b.rarity}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <code className="rounded bg-muted px-1 py-0.5 font-mono">{b.code}</code>
                    <span>·</span>
                    <span>icon: {b.icon}</span>
                    <span>·</span>
                    <span>{b.conditionType}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Attribué à {b._count.users} utilisateur{b._count.users > 1 ? "s" : ""}
                    </span>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/badges/${b.id}`}>Éditer</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
