"use client";

import { motion } from "framer-motion";
import { AlertCircle, ArrowUpRight, CheckCircle2, Coins, Flame, Info, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useWallet } from "@/lib/bitquest/hooks";
import { formatDate, formatSats } from "@/lib/bitquest/client";
import { OrbiteMark } from "./brand";
import { EmptyState, ErrorState, LoadingState } from "./ui-bits";
import { useT } from "@/i18n/locale-provider";
import { useLocale } from "@/i18n/locale-provider";

/* Icônes par type de transaction */
const TX_META: Record<string, { icon: LucideIcon; className: string }> = {
  QUEST_REWARD: { icon: CheckCircle2, className: "text-emerald-500" },
  STREAK_BONUS: { icon: Flame, className: "text-orange-500" },
  DAILY_CAP: { icon: AlertCircle, className: "text-zinc-400" },
};

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

function txTime(iso: string, localeTag: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDate(iso)} · ${date.toLocaleTimeString(localeTag, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function WalletView() {
  const t = useT();
  const { locale } = useLocale();
  const localeTag = locale === "fr" ? "fr-FR" : "en-US";
  const walletQuery = useWallet();

  if (walletQuery.isLoading) {
    return <LoadingState label={t("wallet.loading")} />;
  }
  if (walletQuery.isError || !walletQuery.data) {
    return (
      <ErrorState
        message={t("wallet.error")}
        onRetry={() => walletQuery.refetch()}
      />
    );
  }

  const wallet = walletQuery.data;
  const dailyPct =
    wallet.dailyCap > 0 ? Math.min(100, Math.round((wallet.dailyUsed / wallet.dailyCap) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* ===== Hero wallet — carte style bancaire ===== */}
      <motion.section {...fadeUp} transition={{ duration: 0.35 }}>
        <Card className="relative overflow-hidden rounded-xl border-primary/30 bg-gradient-to-br from-primary/20 via-card to-card">
          <OrbiteMark
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-10 h-52 w-52 select-none text-primary opacity-10"
          />
          <CardContent className="relative space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {t("wallet.hero.label")}
              </p>
              <Badge
                variant="outline"
                className="gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
              >
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                {t("wallet.hero.badge")}
              </Badge>
            </div>
            <div className="space-y-1.5">
              <p className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
                {formatSats(wallet.balance)}{" "}
                <span className="text-xl font-bold text-muted-foreground sm:text-2xl">sats</span>
              </p>
              <p className="flex items-center gap-1.5 text-sm text-emerald-500">
                <ArrowUpRight className="h-4 w-4" aria-hidden />
                {t("wallet.hero.cumulative", { amount: formatSats(wallet.totalEarned) })}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {/* ===== Plafond journalier ===== */}
      <motion.section {...fadeUp} transition={{ duration: 0.35, delay: 0.05 }}>
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>{t("wallet.cap.title")}</CardTitle>
            <CardDescription>{t("wallet.cap.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress
              value={dailyPct}
              className="h-2.5"
              aria-label={t("wallet.cap.aria", { pct: dailyPct })}
            />
            <p className="text-sm font-medium">
              {t("wallet.cap.progress", {
                used: formatSats(wallet.dailyUsed),
                cap: formatSats(wallet.dailyCap),
              })}
            </p>
            <p className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {t("wallet.cap.note")}
            </p>
          </CardContent>
        </Card>
      </motion.section>

      {/* ===== Historique des gains ===== */}
      <motion.section {...fadeUp} transition={{ duration: 0.35, delay: 0.1 }}>
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>{t("wallet.history.title")}</CardTitle>
            <CardDescription>{t("wallet.history.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {wallet.transactions.length > 0 ? (
              <ul
                className="max-h-96 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar]:w-1.5"
                aria-label={t("wallet.history.aria")}
              >
                {wallet.transactions.map((tx) => {
                  const meta = TX_META[tx.type];
                  const Icon = meta?.icon ?? Coins;
                  const isCapped = tx.type === "DAILY_CAP";
                  return (
                    <li key={tx.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon
                          className={`h-4 w-4 ${meta?.className ?? "text-muted-foreground"}`}
                          aria-hidden
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">{txTime(tx.createdAt, localeTag)}</p>
                      </div>
                      {isCapped ? (
                        <span className="shrink-0 text-sm text-muted-foreground">0</span>
                      ) : (
                        <span className="shrink-0 text-sm font-semibold text-amber-500">
                          +{formatSats(tx.amount)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon={Coins}
                title={t("wallet.history.empty.title")}
                sub={t("wallet.history.empty.sub")}
              />
            )}
          </CardContent>
        </Card>
      </motion.section>
    </div>
  );
}
