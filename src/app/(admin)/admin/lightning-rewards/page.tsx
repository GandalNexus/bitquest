import Link from "next/link";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, XCircle, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminOrDenied } from "../_require-admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const STATUSES = ["PENDING", "PAID", "FAILED"] as const;

const statusStyles: Record<string, string> = {
  PAID: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  PENDING: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  FAILED: "border-destructive/40 bg-destructive/10 text-destructive",
};

const statusIcons: Record<string, typeof CheckCircle2> = {
  PAID: CheckCircle2,
  PENDING: Clock,
  FAILED: XCircle,
};

function formatDateTime(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export default async function AdminLightningRewardsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; page?: string }>;
}) {
  const gate = await requireAdminOrDenied();
  if (!gate.ok) return gate.element;

  const sp = (await searchParams) ?? {};
  const statusFilter =
    sp.status && (STATUSES as readonly string[]).includes(sp.status) ? sp.status : null;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const where = statusFilter ? { status: statusFilter } : undefined;
  const [rewards, totalCount, paidCount, failedCount, pendingCount, sumPaidMsat] =
    await Promise.all([
      db.lightningReward.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { pseudo: true, email: true } } },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      db.lightningReward.count({ where }),
      db.lightningReward.count({ where: { status: "PAID" } }),
      db.lightningReward.count({ where: { status: "FAILED" } }),
      db.lightningReward.count({ where: { status: "PENDING" } }),
      db.lightningReward.aggregate({
        where: { status: "PAID" },
        _sum: { amountMsat: true },
      }),
    ]);

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const qs = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string | null> = {
      status: statusFilter,
      page: null,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    return params.toString();
  };

  const paidSats = Math.floor((sumPaidMsat._sum.amountMsat ?? 0) / 1000);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Lightning Rewards
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tentatives et paiements Lightning réels (sats hors-jeu). Flux isolé des
          sats simulés — voir <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
            src/lib/lightning/rewards.ts
          </code>.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="PAID" value={paidCount} className={statusStyles.PAID} />
        <Stat label="PENDING" value={pendingCount} className={statusStyles.PENDING} />
        <Stat label="FAILED" value={failedCount} className={statusStyles.FAILED} />
        <Stat label="Sats payés" value={paidSats.toLocaleString("fr-FR")} className="border-primary/40 bg-primary/10 text-primary" />
      </section>

      <section className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer par statut">
        <FilterChip href={`/admin/lightning-rewards?${qs({ status: null })}`} active={statusFilter === null} label={`Tous (${totalCount})`} />
        {STATUSES.map((s) => (
          <FilterChip
            key={s}
            href={`/admin/lightning-rewards?${qs({ status: s })}`}
            active={statusFilter === s}
            label={s}
          />
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-primary" aria-hidden />
            Tentatives récentes
          </CardTitle>
          <CardDescription>
            {rewards.length} ligne{rewards.length > 1 ? "s" : ""} affichée
            {rewards.length > 1 ? "s" : ""}
            {pageCount > 1 ? ` · page ${page}/${pageCount}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {rewards.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Aucune récompense {statusFilter ? `avec statut ${statusFilter}` : "pour l'instant"}.
            </p>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Utilisateur</th>
                  <th className="px-4 py-2 font-medium">Montant</th>
                  <th className="px-4 py-2 font-medium">Statut</th>
                  <th className="px-4 py-2 font-medium">Invoice</th>
                  <th className="px-4 py-2 font-medium">Raison</th>
                  <th className="px-4 py-2 font-medium">Créé le</th>
                </tr>
              </thead>
              <tbody>
                {rewards.map((r) => {
                  const Icon = statusIcons[r.status] ?? Clock;
                  return (
                    <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">{r.user.pseudo}</td>
                      <td className="px-4 py-2 tabular-nums text-muted-foreground">
                        {Math.floor(r.amountMsat / 1000).toLocaleString("fr-FR")} sats
                      </td>
                      <td className="px-4 py-2">
                        <Badge
                          variant="outline"
                          className={statusStyles[r.status] ?? statusStyles.PENDING}
                        >
                          <Icon className="h-3 w-3" aria-hidden />
                          {r.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">
                        {truncate(r.invoiceBolt11, 30)}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {r.failureReason ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {formatDateTime(r.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
            <span>Page {page} / {pageCount}</span>
            <div className="flex items-center gap-1">
              <PageLink href={`/admin/lightning-rewards?${qs({ page: String(page - 1) })}`} disabled={page <= 1} direction="prev" label="Précédente" />
              <PageLink href={`/admin/lightning-rewards?${qs({ page: String(page + 1) })}`} disabled={page >= pageCount} direction="next" label="Suivante" />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: number | string; className: string }) {
  return (
    <div className={`rounded-md border px-3 py-2 ${className}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
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

function PageLink({
  href,
  disabled,
  direction,
  label,
}: {
  href: string;
  disabled: boolean;
  direction: "prev" | "next";
  label: string;
}) {
  if (disabled) {
    return (
      <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border px-2 py-1 text-muted-foreground/50">
        {direction === "prev" && <ChevronLeft className="h-3.5 w-3.5" aria-hidden />}
        {label}
        {direction === "next" && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 transition-colors hover:border-primary/40 hover:text-foreground"
    >
      {direction === "prev" && <ChevronLeft className="h-3.5 w-3.5" aria-hidden />}
      {label}
      {direction === "next" && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
    </Link>
  );
}
