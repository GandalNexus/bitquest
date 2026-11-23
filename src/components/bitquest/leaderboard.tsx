"use client";

import { motion } from "framer-motion";
import { Crown, Flame, Trophy, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLeaderboard } from "@/lib/bitquest/hooks";
import { formatSats, type LeaderboardEntry } from "@/lib/bitquest/client";
import { EmptyState, ErrorState, LoadingState } from "./ui-bits";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/locale-provider";

/* Médailles du top 3 */
const MEDAL_CLASS: Record<number, string> = {
  1: "text-amber-400",
  2: "text-zinc-300",
  3: "text-amber-700",
};

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

function PodiumCard({
  entry,
  place,
  t,
}: {
  entry: LeaderboardEntry;
  place: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const isFirst = place === 1;
  return (
    <div
      className={cn(
        "relative flex-1 rounded-xl border bg-card p-4 text-center transition-shadow",
        isFirst && "ring-2 ring-primary shadow-lg sm:pb-8 sm:pt-6",
      )}
    >
      {isFirst && (
        <Crown
          className="absolute -top-3.5 left-1/2 h-7 w-7 -translate-x-1/2 text-amber-400 drop-shadow"
          aria-hidden
        />
      )}
      <p
        className={cn(
          "text-xs font-bold uppercase tracking-widest",
          MEDAL_CLASS[place] ?? "text-muted-foreground",
        )}
      >
        #{place}
      </p>
      <div
        className={cn(
          "mx-auto mt-2 flex items-center justify-center rounded-full bg-primary/10 text-primary",
          isFirst ? "h-14 w-14" : "h-11 w-11",
        )}
      >
        <Trophy className={isFirst ? "h-6 w-6" : "h-5 w-5"} aria-hidden />
      </div>
      <p className="mt-2 truncate font-bold">{entry.pseudo}</p>
      <p className="truncate text-xs text-muted-foreground">
        {t("common.levelShort")} {entry.levelInfo.level} · {entry.levelInfo.title}
      </p>
      <p className={cn("mt-1.5 font-semibold text-primary", isFirst && "text-lg")}>
        {formatSats(entry.xp)} XP
      </p>
    </div>
  );
}

function RankRow({
  entry,
  t,
}: {
  entry: LeaderboardEntry;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5",
        entry.isMe && "ring-1 ring-primary bg-primary/5",
      )}
    >
      <span
        className={cn(
          "w-9 shrink-0 text-center text-sm font-black tabular-nums",
          MEDAL_CLASS[entry.rank] ?? "text-muted-foreground",
        )}
      >
        #{entry.rank}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-semibold">{entry.pseudo}</span>
        {entry.isBot && (
          <Badge
            variant="outline"
            className="shrink-0 border-zinc-500/30 px-1.5 py-0 text-[10px] text-zinc-400"
          >
            {t("leaderboard.badge.bot")}
          </Badge>
        )}
        {entry.isMe && (
          <Badge className="shrink-0 bg-primary/15 px-1.5 py-0 text-[10px] text-primary">
            {t("leaderboard.badge.you")}
          </Badge>
        )}
      </div>
      <span className="hidden w-16 shrink-0 text-right text-xs text-muted-foreground sm:block">
        {t("common.levelShort")} {entry.levelInfo.level}
      </span>
      <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">
        {formatSats(entry.xp)}
      </span>
      <span className="hidden w-16 shrink-0 items-center justify-end gap-1 text-xs text-muted-foreground sm:flex">
        <Trophy className="h-3.5 w-3.5" aria-hidden />
        {entry.badges}
      </span>
      <span className="hidden w-16 shrink-0 items-center justify-end gap-1 text-xs text-muted-foreground sm:flex">
        <Flame className="h-3.5 w-3.5 text-orange-500" aria-hidden />
        {entry.streak}
      </span>
    </li>
  );
}

export function Leaderboard() {
  const t = useT();
  const lbQuery = useLeaderboard();

  if (lbQuery.isLoading) {
    return <LoadingState label={t("leaderboard.loading")} />;
  }
  if (lbQuery.isError || !lbQuery.data) {
    return (
      <ErrorState
        message={t("leaderboard.error")}
        onRetry={() => lbQuery.refetch()}
      />
    );
  }

  const entries = lbQuery.data.entries ?? [];
  const top = entries.slice(0, 20);
  const meEntry = entries.find((e) => e.isMe);
  const meVisible = !!meEntry && top.some((e) => e.isMe);
  const podium = [top[0], top[1], top[2]];

  return (
    <div className="space-y-6">
      <motion.section {...fadeUp} transition={{ duration: 0.35 }} className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Trophy className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">{t("leaderboard.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("leaderboard.subtitle")}</p>
        </div>
      </motion.section>

      {entries.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={t("leaderboard.empty.title")}
          sub={t("leaderboard.empty.sub")}
        />
      ) : (
        <>
          <motion.section {...fadeUp} transition={{ duration: 0.35, delay: 0.05 }}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
              {podium[1] && (
                <div className="order-2 sm:order-1">
                  <PodiumCard entry={podium[1]} place={2} t={t} />
                </div>
              )}
              {podium[0] && (
                <div className="order-1 sm:order-2">
                  <PodiumCard entry={podium[0]} place={1} t={t} />
                </div>
              )}
              {podium[2] && (
                <div className="order-3">
                  <PodiumCard entry={podium[2]} place={3} t={t} />
                </div>
              )}
            </div>
          </motion.section>

          <motion.section {...fadeUp} transition={{ duration: 0.35, delay: 0.1 }}>
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle>{t("leaderboard.detail.title")}</CardTitle>
                <CardDescription>{t("leaderboard.detail.description")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  aria-hidden
                  className="mb-2 hidden items-center gap-3 px-3 text-[11px] uppercase tracking-wider text-muted-foreground sm:flex"
                >
                  <span className="w-9 shrink-0 text-center">{t("leaderboard.col.rank")}</span>
                  <span className="min-w-0 flex-1">{t("leaderboard.col.adventurer")}</span>
                  <span className="w-16 shrink-0 text-right">{t("leaderboard.col.level")}</span>
                  <span className="w-24 shrink-0 text-right">{t("leaderboard.col.xp")}</span>
                  <span className="w-16 shrink-0 text-right">{t("leaderboard.col.badges")}</span>
                  <span className="w-16 shrink-0 text-right">{t("leaderboard.col.streak")}</span>
                </div>
                <ul
                  className="max-h-96 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar]:w-1.5"
                  aria-label={t("leaderboard.aria.list")}
                >
                  {top.map((entry) => (
                    <RankRow key={entry.id} entry={entry} t={t} />
                  ))}
                </ul>

                {meEntry && !meVisible && (
                  <div className="mt-3 flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2.5">
                    <span className="w-9 shrink-0 text-center text-sm font-black text-primary tabular-nums">
                      #{meEntry.rank}
                    </span>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate text-sm font-semibold">{meEntry.pseudo}</span>
                      <Badge className="shrink-0 bg-primary/15 px-1.5 py-0 text-[10px] text-primary">
                        {t("leaderboard.badge.you")}
                      </Badge>
                    </div>
                    <span className="hidden w-16 shrink-0 text-right text-xs text-muted-foreground sm:block">
                      {t("common.levelShort")} {meEntry.levelInfo.level}
                    </span>
                    <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">
                      {formatSats(meEntry.xp)}
                    </span>
                    <span className="hidden w-16 shrink-0 items-center justify-end gap-1 text-xs text-muted-foreground sm:flex">
                      <Trophy className="h-3.5 w-3.5" aria-hidden />
                      {meEntry.badges}
                    </span>
                    <span className="hidden w-16 shrink-0 items-center justify-end gap-1 text-xs text-muted-foreground sm:flex">
                      <Flame className="h-3.5 w-3.5 text-orange-500" aria-hidden />
                      {meEntry.streak}
                    </span>
                  </div>
                )}
                {meEntry && !meVisible && (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    {t("leaderboard.me.hint", { rank: meEntry.rank })}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.section>
        </>
      )}
    </div>
  );
}
