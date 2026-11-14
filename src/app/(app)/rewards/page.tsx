import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, TrendingUp, XCircle, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRoleSsr } from "@/lib/auth/server";
import { isFeatureEnabled } from "@/lib/feature-flag";
import { db } from "@/lib/db";
import { RedeemForm } from "./redeem-form";
import { parseQuestCodeHint } from "./from-param";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Récompenses Lightning — BitQuest",
};

/**
 * Page apprenant pour réclamer une récompense Lightning réelle (P4).
 *
 * Deux états :
 *   1. Flag OFF pour ce user → carte informative + waitlist.
 *   2. Flag ON → formulaire invoice + historique des 10 dernières demandes.
 *
 * ⚠️ Historique affiché ici ≠ wallet simulé (`/wallet`). Les deux rails
 * restent strictement séparés (manifesto § sim/réel).
 */
export default async function RewardsPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string }>;
}) {
  const auth = await requireRoleSsr("APPRENTICE");
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") redirect("/");
    redirect("/dashboard");
  }

  const user = auth.user;
  const enabled = await isFeatureEnabled("lightning.rewards", user.id);

  const sp = (await searchParams) ?? {};
  // `?from=<questCode>` : contexte de redirection depuis le flash récompense
  // d'une quête complétée. Normalise strictement (slug) via helper testé.
  const fromQuestCode = parseQuestCodeHint(sp.from);

  // Page SSR async — Date.now() au moment du request est déterministe
  // pour cette requête. L'eslint rule « react-hooks/purity » vise les
  // composants React render, pas les server actions async.
  // eslint-disable-next-line react-hooks/purity
  const since30d = new Date(Date.now() - THIRTY_DAYS_MS);
  const [history, stats30dRaw, topFailuresRaw] = enabled
    ? await Promise.all([
        db.lightningReward.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            status: true,
            amountMsat: true,
            feeMsat: true,
            failureReason: true,
            createdAt: true,
            paidAt: true,
          },
        }),
        db.lightningReward.groupBy({
          by: ["status"],
          where: { userId: user.id, createdAt: { gte: since30d } },
          _count: { _all: true },
          _sum: { amountMsat: true, feeMsat: true },
        }),
        db.lightningReward.groupBy({
          by: ["failureReason"],
          where: {
            userId: user.id,
            status: "FAILED",
            createdAt: { gte: since30d },
            failureReason: { not: null },
          },
          _count: { _all: true },
          orderBy: { _count: { failureReason: "desc" } },
          take: 3,
        }),
      ])
    : [[], [], []] as const;

  const paid30d = stats30dRaw.find((s) => s.status === "PAID");
  const failed30d = stats30dRaw.find((s) => s.status === "FAILED");
  const pending30d = stats30dRaw.find((s) => s.status === "PENDING");
  const paidCount = paid30d?._count._all ?? 0;
  const paidSats = Math.floor((paid30d?._sum.amountMsat ?? 0) / 1000);
  const feeSats = Math.floor((paid30d?._sum.feeMsat ?? 0) / 1000);
  const failedCount = failed30d?._count._all ?? 0;
  const pendingCount = pending30d?._count._all ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
          <Zap className="h-7 w-7 text-primary" aria-hidden />
          Récompenses Lightning
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Convertis une partie de tes efforts BitQuest en sats <strong>réels</strong> sur
          un réseau Lightning. Ce flux est strictement isolé du wallet simulé
          du jeu — il y a toujours une invoice BOLT11 à fournir de ton côté.
        </p>
      </header>

      {!enabled ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
              Programme pas encore ouvert pour ton compte
            </CardTitle>
            <CardDescription>
              La distribution Lightning réelle est activée par vagues restreintes.
              Continue tes quêtes ; le programme ouvre selon la gouvernance ops et
              les quotas testnet disponibles.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            En attendant, les sats affichés dans ton wallet BitQuest restent
            pédagogiques — ils comptent dans les classements et débloquent des
            niveaux, mais ne quittent pas le serveur de jeu.
          </CardContent>
        </Card>
      ) : (
        <>
          {fromQuestCode && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
            >
              <strong className="font-medium text-amber-600 dark:text-amber-400">
                Tu viens de compléter la quête « {fromQuestCode} »
              </strong>
              <span className="ml-1 text-muted-foreground">
                — colle une invoice BOLT11 pour recevoir tes sats réels.
              </span>
            </div>
          )}

          {/* Dashboard 30j */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryTile
              label="Payées 30j"
              value={paidCount.toLocaleString("fr-FR")}
              hint={paidSats > 0 ? `${paidSats.toLocaleString("fr-FR")} sats reçus` : "—"}
              Icon={CheckCircle2}
              tone="success"
            />
            <SummaryTile
              label="Frais LN 30j"
              value={feeSats.toLocaleString("fr-FR")}
              hint={feeSats > 0 ? "sats de routage" : "—"}
              Icon={TrendingUp}
              tone="neutral"
            />
            <SummaryTile
              label="Refusées 30j"
              value={failedCount.toLocaleString("fr-FR")}
              hint={failedCount > 0 ? "voir top raisons" : "—"}
              Icon={XCircle}
              tone={failedCount > 0 ? "danger" : "neutral"}
            />
            <SummaryTile
              label="En attente"
              value={pendingCount.toLocaleString("fr-FR")}
              hint={pendingCount > 0 ? "paiement en cours côté LND" : "—"}
              Icon={Clock}
              tone={pendingCount > 0 ? "warning" : "neutral"}
            />
          </section>

          {topFailuresRaw.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top raisons de refus (30j)</CardTitle>
                <CardDescription>
                  Les codes d&apos;erreur les plus fréquents côté serveur — utile pour
                  ajuster ton invoice ou patienter si c&apos;est un plafond.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {topFailuresRaw.map((f) => (
                    <li
                      key={f.failureReason ?? "unknown"}
                      className="flex items-center justify-between text-sm"
                    >
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {f.failureReason ?? "—"}
                      </code>
                      <span className="tabular-nums text-muted-foreground">
                        {f._count._all}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Envoyer une récompense</CardTitle>
              <CardDescription>
                Ton paiement part depuis le node Lightning du serveur BitQuest
                vers l&apos;invoice que tu fournis. Pas d&apos;auto-complétion —
                le montant doit être explicite dans l&apos;invoice.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RedeemForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historique (10 dernières)</CardTitle>
              <CardDescription>
                Chaque tentative apparaît ici, même si elle a été refusée côté
                serveur (plafond, format, etc.).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {history.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Aucune tentative pour l&apos;instant.
                </p>
              ) : (
                <ul className="divide-y">
                  {history.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {Math.floor(r.amountMsat / 1000).toLocaleString("fr-FR")} sats
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.status === "PAID"
                            ? `Payé le ${r.paidAt?.toLocaleString("fr-FR") ?? "—"}`
                            : r.status === "FAILED"
                              ? `Refusé — ${r.failureReason ?? "raison inconnue"}`
                              : "En attente"}
                        </div>
                      </div>
                      <span
                        className={
                          r.status === "PAID"
                            ? "rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-500"
                            : r.status === "FAILED"
                              ? "rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive"
                              : "rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-500"
                        }
                      >
                        {r.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  Icon: typeof Zap;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  const tones = {
    success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    warning: "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400",
    danger: "border-destructive/30 bg-destructive/5 text-destructive",
    neutral: "border-border bg-card text-muted-foreground",
  } as const;
  return (
    <div className={`rounded-md border px-3 py-2.5 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider opacity-80">
          {label}
        </span>
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </div>
      <div className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] opacity-75">{hint}</div>
    </div>
  );
}
