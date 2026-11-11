import Link from "next/link";
import { Download, FlaskConical, Timer, CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const OUTCOMES = [
  "ACCEPTED",
  "REJECTED",
  "NOT_FOUND",
  "UNAVAILABLE",
  "INVALID_JWT",
  "MEMPOOL",
  "BAD_REQUEST",
  "RATE_LIMITED",
] as const;

type Outcome = (typeof OUTCOMES)[number];

const outcomeStyles: Record<string, string> = {
  ACCEPTED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  REJECTED: "border-destructive/40 bg-destructive/10 text-destructive",
  NOT_FOUND: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  UNAVAILABLE: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  INVALID_JWT: "border-rose-500/40 bg-rose-500/10 text-rose-500",
  MEMPOOL: "border-blue-500/40 bg-blue-500/10 text-blue-500",
  BAD_REQUEST: "border-destructive/40 bg-destructive/10 text-destructive",
  RATE_LIMITED: "border-rose-500/40 bg-rose-500/10 text-rose-500",
};

function formatDateTime(d: Date): string {
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default async function AdminBitlabAttemptsPage({
  searchParams,
}: {
  searchParams: Promise<{ outcome?: string; quest?: string }>;
}) {
  const { outcome: outcomeFilter, quest: questFilter } = await searchParams;
  const outcome =
    outcomeFilter && OUTCOMES.includes(outcomeFilter as Outcome)
      ? (outcomeFilter as Outcome)
      : null;
  const questCode = questFilter?.trim() || null;

  const where = {
    ...(outcome ? { outcome } : {}),
    ...(questCode ? { questCode } : {}),
  };

  // Stats rolling 24h — agrégation côté DB. new Date() au lieu de
  // Date.now() pour contenter react-hooks/purity (ce composant est async
  // server-side, mais le lint applique la règle au body de fonction).
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [entries, totalCount, byOutcome24h, allKnownQuests] = await Promise.all([
    db.bitLabProofAttempt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.bitLabProofAttempt.count({ where }),
    db.bitLabProofAttempt.groupBy({
      by: ["outcome"],
      where: { createdAt: { gte: last24h } },
      _count: true,
      _avg: { latencyMs: true },
    }),
    db.bitLabProofAttempt.findMany({
      distinct: ["questCode"],
      select: { questCode: true },
      where: { questCode: { not: "" } },
      orderBy: { questCode: "asc" },
    }),
  ]);

  // Enrichit avec pseudo utilisateur (jointure côté app, on a pas de FK)
  const userIds = Array.from(new Set(entries.map((e) => e.userId)));
  const users =
    userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, pseudo: true },
        })
      : [];
  const pseudoById = new Map(users.map((u) => [u.id, u.pseudo]));

  const total24h = byOutcome24h.reduce((sum, row) => sum + row._count, 0);
  const accepted24h =
    byOutcome24h.find((r) => r.outcome === "ACCEPTED")?._count ?? 0;
  const acceptedPct = total24h > 0 ? Math.round((accepted24h / total24h) * 100) : 0;
  const avgLatency =
    total24h > 0
      ? Math.round(
          byOutcome24h.reduce(
            (sum, r) => sum + (r._avg.latencyMs ?? 0) * r._count,
            0,
          ) / total24h,
        )
      : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            BitLab · Journal de preuves
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Toutes les tentatives sur{" "}
            <code className="rounded bg-muted px-1">/api/bitlab/proof</code> (acceptées et
            refusées). {totalCount > 100 && `${totalCount} entrées au total.`}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 gap-2">
          <Link
            href={buildExportHref(outcome, questCode)}
            prefetch={false}
            // Reload={false} laisse Next gérer la navigation vers la route ; l'en-tête
            // Content-Disposition déclenche le téléchargement côté navigateur.
          >
            <Download className="h-4 w-4" aria-hidden />
            Exporter CSV
          </Link>
        </Button>
      </header>

      {/* Stats 24h */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Tentatives (24h)
            </CardDescription>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FlaskConical className="h-4 w-4" aria-hidden />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-display text-3xl font-bold">
              {total24h.toLocaleString("fr-FR")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Fenêtre glissante dernières 24 h
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Taux d&apos;acceptation (24h)
            </CardDescription>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-display text-3xl font-bold">{acceptedPct}%</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {accepted24h} acceptées sur {total24h}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Latence moyenne (24h)
            </CardDescription>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10 text-amber-500">
              <Timer className="h-4 w-4" aria-hidden />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-display text-3xl font-bold">{avgLatency} ms</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Pondérée par volume par outcome
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Ventilation par outcome (24h) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ventilation par outcome · 24h</CardTitle>
          <CardDescription>
            Nombre et latence moyenne par type de sortie du handler.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {byOutcome24h.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune tentative enregistrée sur les dernières 24h.
            </p>
          ) : (
            <ul className="space-y-2">
              {OUTCOMES.map((o) => {
                const row = byOutcome24h.find((r) => r.outcome === o);
                if (!row) return null;
                return (
                  <li
                    key={o}
                    className="flex flex-wrap items-center gap-3 text-sm"
                  >
                    <Badge
                      variant="outline"
                      className={outcomeStyles[o] ?? "border-border"}
                    >
                      {o}
                    </Badge>
                    <span className="font-medium tabular-nums">{row._count}</span>
                    <span className="text-muted-foreground">
                      · {Math.round(row._avg.latencyMs ?? 0)} ms moyen
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Filtres */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Outcome :
          </span>
          <FilterChip
            href={buildHref(null, questCode)}
            active={outcome === null}
            label={`Tous (${totalCount})`}
          />
          {OUTCOMES.map((o) => (
            <FilterChip
              key={o}
              href={buildHref(o, questCode)}
              active={outcome === o}
              label={o}
            />
          ))}
        </div>
        {allKnownQuests.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Quête :
            </span>
            <FilterChip
              href={buildHref(outcome, null)}
              active={questCode === null}
              label="Toutes"
            />
            {allKnownQuests.map((q) => (
              <FilterChip
                key={q.questCode}
                href={buildHref(outcome, q.questCode)}
                active={questCode === q.questCode}
                label={q.questCode}
              />
            ))}
          </div>
        )}
      </section>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dernières tentatives</CardTitle>
          <CardDescription>
            {entries.length} entrée{entries.length > 1 ? "s" : ""} affichée
            {entries.length > 1 ? "s" : ""} (max 100, anti-chronologique)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Aucune tentative pour ce filtre.
            </p>
          ) : (
            <ul className="divide-y">
              {entries.map((e) => {
                const pseudo = pseudoById.get(e.userId) ?? `user_${e.userId.slice(0, 6)}`;
                return (
                  <li key={e.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={outcomeStyles[e.outcome] ?? "border-border"}
                      >
                        {e.outcome === "ACCEPTED" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {e.outcome}
                      </Badge>
                      <span className="text-sm font-medium">{pseudo}</span>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {e.questCode || "—"}
                      </code>
                      <Badge variant="outline" className="text-xs">
                        {e.kind || "—"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {e.network || "—"}
                      </Badge>
                      <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                        <Timer className="h-3 w-3" aria-hidden />
                        <span className="tabular-nums">{e.latencyMs} ms</span>
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatDateTime(e.createdAt)}
                      </span>
                    </div>
                    {e.reasonMessage && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {e.reasonMessage}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function buildHref(outcome: Outcome | null, quest: string | null): string {
  const params = new URLSearchParams();
  if (outcome) params.set("outcome", outcome);
  if (quest) params.set("quest", quest);
  const qs = params.toString();
  return qs ? `/admin/bitlab/attempts?${qs}` : "/admin/bitlab/attempts";
}

function buildExportHref(outcome: Outcome | null, quest: string | null): string {
  const params = new URLSearchParams();
  if (outcome) params.set("outcome", outcome);
  if (quest) params.set("quest", quest);
  const qs = params.toString();
  return qs
    ? `/admin/bitlab/attempts/export?${qs}`
    : "/admin/bitlab/attempts/export";
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <a
      href={href}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
      }`}
    >
      {label}
    </a>
  );
}
