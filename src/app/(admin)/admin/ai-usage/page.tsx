import { ContentLink as Link } from "@/components/admin/content-link";
import { Activity, Coins, Gauge, Sparkles, TrendingUp } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SchedulerConfigPanel } from "./scheduler-config-panel";

export const dynamic = "force-dynamic";

/**
 * Admin — Usage IA (tokens, coûts estimés) + scheduler config.
 *
 * Tarifs Claude Opus 4.7 : input 5$/1M, output 25$/1M. Les tokens cacheRead
 * sont comptés comme input (dans `tokensInput` — cf. generate.ts), donc
 * l'estimation est pessimiste (surestime légèrement si beaucoup de cache hit).
 */
const PRICE_INPUT_PER_M = 5;
const PRICE_OUTPUT_PER_M = 25;

export default async function AIUsagePage() {
  const [all, byType, lastDrafts, configs] = await Promise.all([
    db.aIDraft.aggregate({
      _sum: { tokensInput: true, tokensOutput: true },
      _count: { _all: true },
    }),
    db.aIDraft.groupBy({
      by: ["type", "status"],
      _count: { _all: true },
      _sum: { tokensInput: true, tokensOutput: true },
    }),
    db.aIDraft.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        type: true,
        status: true,
        aiModel: true,
        tokensInput: true,
        tokensOutput: true,
        createdAt: true,
      },
    }),
    db.aIGenerationConfig.findMany(),
  ]);

  const totalIn = all._sum.tokensInput ?? 0;
  const totalOut = all._sum.tokensOutput ?? 0;
  const estimatedUSD =
    (totalIn * PRICE_INPUT_PER_M + totalOut * PRICE_OUTPUT_PER_M) / 1_000_000;

  // Config pour SchedulerConfigPanel : fallback vides si absente.
  const TYPES = ["QUEST", "LESSON", "CHAPTER", "CHALLENGE"] as const;
  const configMap = new Map(configs.map((c) => [c.type, c]));
  const fullConfigs = TYPES.map((t) => {
    const existing = configMap.get(t);
    return {
      type: t,
      enabled: existing?.enabled ?? false,
      cadenceHours: existing?.cadenceHours ?? 24,
      maxPerRun: existing?.maxPerRun ?? 1,
      hint: existing?.hint ?? "",
      lastRunAt: existing?.lastRunAt?.toISOString() ?? null,
      lastError: existing?.lastError ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Gauge className="h-6 w-6 text-primary" />
            Usage IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Consommation tokens Claude + scheduler automatique.
          </p>
        </div>
        <Link
          href="/admin/ai-review"
          className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
        >
          ← Review drafts
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={Sparkles}
          label="Brouillons créés"
          value={String(all._count._all)}
        />
        <StatCard
          icon={TrendingUp}
          label="Tokens total"
          value={`${(totalIn + totalOut).toLocaleString("fr-FR")}`}
          sub={`in ${totalIn.toLocaleString("fr-FR")} · out ${totalOut.toLocaleString("fr-FR")}`}
        />
        <StatCard
          icon={Coins}
          label="Coût estimé"
          value={`$${estimatedUSD.toFixed(2)}`}
          sub="Opus 4.7 · 5$/25$ /1M"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            Par type et statut
          </CardTitle>
          <CardDescription>Agrégat sur toute la période.</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-1.5 text-left font-medium">Type</th>
                <th className="py-1.5 text-left font-medium">Statut</th>
                <th className="py-1.5 text-right font-medium">Brouillons</th>
                <th className="py-1.5 text-right font-medium">Tokens in</th>
                <th className="py-1.5 text-right font-medium">Tokens out</th>
              </tr>
            </thead>
            <tbody>
              {byType.length === 0 && (
                <tr><td className="py-3 text-muted-foreground" colSpan={5}>Aucune donnée.</td></tr>
              )}
              {byType
                .sort((a, b) => a.type.localeCompare(b.type) || a.status.localeCompare(b.status))
                .map((row) => (
                  <tr key={`${row.type}-${row.status}`} className="border-b last:border-0">
                    <td className="py-1.5"><Badge variant="outline">{row.type}</Badge></td>
                    <td className="py-1.5 text-xs">{row.status}</td>
                    <td className="py-1.5 text-right font-mono text-xs">{row._count._all}</td>
                    <td className="py-1.5 text-right font-mono text-xs">{(row._sum.tokensInput ?? 0).toLocaleString("fr-FR")}</td>
                    <td className="py-1.5 text-right font-mono text-xs">{(row._sum.tokensOutput ?? 0).toLocaleString("fr-FR")}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <SchedulerConfigPanel configs={fullConfigs} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Derniers brouillons</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-xs">
          {lastDrafts.length === 0 && (
            <p className="text-muted-foreground">Aucun brouillon généré pour l&apos;instant.</p>
          )}
          {lastDrafts.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 border-b pb-1.5 last:border-0">
              <div className="min-w-0 flex-1 truncate">
                <Badge variant="outline" className="mr-2">{d.type}</Badge>
                <span className="text-muted-foreground">{d.aiModel}</span>
                <span className="text-muted-foreground"> · {new Date(d.createdAt).toLocaleString("fr-FR")}</span>
              </div>
              <div className="shrink-0 font-mono text-[11px] text-muted-foreground">
                in {d.tokensInput ?? 0} · out {d.tokensOutput ?? 0}
              </div>
              <Badge variant="outline">{d.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-primary" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
