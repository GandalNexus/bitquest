"use client";

import { motion } from "framer-motion";
import { Crown, Flame, Trophy, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLeaderboard } from "@/lib/bitquest/hooks";
import { formatSats, type LeaderboardEntry } from "@/lib/bitquest/client";
import { EmptyState, ErrorState, LoadingState } from "./ui-bits";
import { cn } from "@/lib/utils";

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

function PodiumCard({ entry, place }: { entry: LeaderboardEntry; place: number }) {
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
        Nv. {entry.levelInfo.level} · {entry.levelInfo.title}
      </p>
      <p className={cn("mt-1.5 font-semibold text-primary", isFirst && "text-lg")}>
        {formatSats(entry.xp)} XP
      </p>
    </div>
  );
}

function RankRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5",
        entry.isMe && "ring-1 ring-primary bg-primary/5",
      )}
    >
      {/* Rang */}
      <span
        className={cn(
          "w-9 shrink-0 text-center text-sm font-black tabular-nums",
          MEDAL_CLASS[entry.rank] ?? "text-muted-foreground",
        )}
      >
        #{entry.rank}
      </span>
      {/* Pseudo + badges d'état */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-semibold">{entry.pseudo}</span>
        {entry.isBot && (
          <Badge
            variant="outline"
            className="shrink-0 border-zinc-500/30 px-1.5 py-0 text-[10px] text-zinc-400"
          >
            bot
          </Badge>
        )}
        {entry.isMe && (
          <Badge className="shrink-0 bg-primary/15 px-1.5 py-0 text-[10px] text-primary">
            toi
          </Badge>
        )}
      </div>
      {/* Niveau */}
      <span className="hidden w-16 shrink-0 text-right text-xs text-muted-foreground sm:block">
        Nv. {entry.levelInfo.level}
      </span>
      {/* XP */}
      <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">
        {formatSats(entry.xp)}
      </span>
      {/* Badges */}
      <span className="hidden w-16 shrink-0 items-center justify-end gap-1 text-xs text-muted-foreground sm:flex">
        <Trophy className="h-3.5 w-3.5" aria-hidden />
        {entry.badges}
      </span>
      {/* Streak */}
      <span className="hidden w-16 shrink-0 items-center justify-end gap-1 text-xs text-muted-foreground sm:flex">
        <Flame className="h-3.5 w-3.5 text-orange-500" aria-hidden />
        {entry.streak}
      </span>
    </li>
  );
}

export function Leaderboard() {
  const lbQuery = useLeaderboard();

  if (lbQuery.isLoading) {
    return <LoadingState label="Classement en cours de calcul…" />;
  }
  if (lbQuery.isError || !lbQuery.data) {
    return (
      <ErrorState
        message="Impossible de charger le classement. Vérifie ta connexion."
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
      {/* ===== Header ===== */}
      <motion.section {...fadeUp} transition={{ duration: 0.35 }} className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Trophy className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">Classement des aventuriers</h1>
          <p className="text-sm text-muted-foreground">Top 20 par XP</p>
        </div>
      </motion.section>

      {entries.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Classement vide pour l'instant"
          sub="Sois le premier à gravir les rangs en terminant des quêtes."
        />
      ) : (
        <>
          {/* ===== Podium (ordre visuel 2-1-3 sur desktop) ===== */}
          <motion.section {...fadeUp} transition={{ duration: 0.35, delay: 0.05 }}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
              {podium[1] && (
                <div className="order-2 sm:order-1">
                  <PodiumCard entry={podium[1]} place={2} />
                </div>
              )}
              {podium[0] && (
                <div className="order-1 sm:order-2">
                  <PodiumCard entry={podium[0]} place={1} />
                </div>
              )}
              {podium[2] && (
                <div className="order-3">
                  <PodiumCard entry={podium[2]} place={3} />
                </div>
              )}
            </div>
          </motion.section>

          {/* ===== Tableau ===== */}
          <motion.section {...fadeUp} transition={{ duration: 0.35, delay: 0.1 }}>
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle>Détail du classement</CardTitle>
                <CardDescription>
                  XP, badges et séries d&apos;activité des 20 premiers aventuriers.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* En-têtes de colonnes (desktop) */}
                <div
                  aria-hidden
                  className="mb-2 hidden items-center gap-3 px-3 text-[11px] uppercase tracking-wider text-muted-foreground sm:flex"
                >
                  <span className="w-9 shrink-0 text-center">Rang</span>
                  <span className="min-w-0 flex-1">Aventurier</span>
                  <span className="w-16 shrink-0 text-right">Niveau</span>
                  <span className="w-24 shrink-0 text-right">XP</span>
                  <span className="w-16 shrink-0 text-right">Badges</span>
                  <span className="w-16 shrink-0 text-right">Série</span>
                </div>
                <ul
                  className="max-h-96 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar]:w-1.5"
                  aria-label="Liste classée des aventuriers"
                >
                  {top.map((entry) => (
                    <RankRow key={entry.id} entry={entry} />
                  ))}
                </ul>

                {/* Ta position si hors du top 20 */}
                {meEntry && !meVisible && (
                  <div className="mt-3 flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2.5">
                    <span className="w-9 shrink-0 text-center text-sm font-black text-primary tabular-nums">
                      #{meEntry.rank}
                    </span>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate text-sm font-semibold">{meEntry.pseudo}</span>
                      <Badge className="shrink-0 bg-primary/15 px-1.5 py-0 text-[10px] text-primary">
                        toi
                      </Badge>
                    </div>
                    <span className="hidden w-16 shrink-0 text-right text-xs text-muted-foreground sm:block">
                      Nv. {meEntry.levelInfo.level}
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
                    Ta position : #{meEntry.rank} — gagne de l&apos;XP pour intégrer le top 20 !
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
