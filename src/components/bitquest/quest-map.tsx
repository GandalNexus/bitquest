"use client";

import { Fragment } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { BookOpen, CheckCircle2, ChevronRight, Lock, Map, Play, Target, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatSats } from "@/lib/bitquest/client";
import type { QuestState } from "@/lib/bitquest/client";
import { useQuests } from "@/lib/bitquest/hooks";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  RewardChips,
  StatCard,
  statusLabels,
  trackStyles,
} from "./ui-bits";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const TRACK_ORDER = ["INITIATION", "INTERMEDIATE", "ADVANCED", "SPECIAL"] as const;

function getTrackStyle(track: string) {
  return (
    trackStyles[track] ?? {
      label: track,
      badge: "bg-primary/15 text-primary border-primary/30",
      dot: "bg-primary",
      ring: "ring-primary/40",
      text: "text-primary",
    }
  );
}

function StatusIcon({ quest }: { quest: QuestState }) {
  if (quest.locked) {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-muted/50 text-muted-foreground">
        <Lock className="h-4.5 w-4.5" />
      </span>
    );
  }
  if (quest.status === "COMPLETED") {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10">
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
      </span>
    );
  }
  const started = quest.status !== "AVAILABLE";
  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
        started
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-muted/50 text-muted-foreground",
      )}
    >
      <Play className={cn("h-4 w-4", started && "fill-current")} />
    </span>
  );
}

function QuestCard({
  quest,
  index,
  onOpenQuest,
}: {
  quest: QuestState;
  index: number;
  onOpenQuest?: (code: string) => void;
}) {
  const ts = getTrackStyle(quest.track);
  const locked = quest.locked;
  const completed = quest.status === "COMPLETED";
  const started = !locked && quest.status !== "AVAILABLE";
  const sectionsPct =
    quest.totalSections > 0 ? Math.round((quest.sectionsRead / quest.totalSections) * 100) : 0;

  const card = (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border bg-card p-4 transition-shadow sm:gap-4 sm:p-5",
        locked && "cursor-not-allowed opacity-60",
        !locked && "cursor-pointer hover:shadow-md hover:ring-2",
        !locked && ts.ring,
        completed && "border-l-4 border-l-emerald-500",
      )}
    >
      <StatusIcon quest={quest} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h3 className="font-bold leading-tight">{quest.title}</h3>
          <span className="truncate text-xs text-muted-foreground">{quest.subtitle}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{quest.description}</p>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <RewardChips xp={quest.xpReward} sats={quest.satsReward} />
          <Badge variant="outline" className={cn(completed && "border-emerald-500/40 text-emerald-500")}>
            {statusLabels[quest.status] ?? quest.status}
          </Badge>
        </div>

        {locked && quest.lockReason && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3 shrink-0" />
            <span>{quest.lockReason}</span>
          </div>
        )}

        {!locked && !completed && started && (
          <div className="mt-2.5 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                Sections lues {quest.sectionsRead}/{quest.totalSections}
              </span>
              {quest.quizBestScore > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  Quiz : {quest.quizBestScore} %
                </span>
              )}
            </div>
            <Progress value={sectionsPct} className="h-1.5" />
          </div>
        )}
      </div>
      {!locked && <ChevronRight className="mt-1 hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.05, 0.3) }}
      whileHover={locked ? undefined : { y: -2 }}
    >
      {locked ? (
        <div aria-disabled="true">{card}</div>
      ) : onOpenQuest ? (
        <button
          type="button"
          onClick={() => onOpenQuest(quest.code)}
          aria-label={`Ouvrir la quête ${quest.title}`}
          className="w-full text-left"
        >
          {card}
        </button>
      ) : (
        <Link
          href={`/quests/${quest.code}`}
          aria-label={`Ouvrir la quête ${quest.title}`}
          className="block w-full text-left"
        >
          {card}
        </Link>
      )}
    </motion.div>
  );
}

function TrackSection({
  track,
  quests,
  onOpenQuest,
}: {
  track: string;
  quests: QuestState[];
  onOpenQuest?: (code: string) => void;
}) {
  const ts = getTrackStyle(track);
  const doneCount = quests.filter((q) => q.status === "COMPLETED").length;

  return (
    <section aria-label={`Parcours ${ts.label}`}>
      <div className="flex items-center gap-3">
        <Badge variant="outline" className={cn("gap-1.5 px-3 py-1 text-xs font-bold", ts.badge)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", ts.dot)} />
          {ts.label}
        </Badge>
        <span className="shrink-0 text-xs text-muted-foreground">
          {doneCount}/{quests.length} terminée{doneCount > 1 ? "s" : ""}
        </span>
        <div className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>

      <div className="mt-4 flex flex-col">
        {quests.map((quest, i) => (
          <Fragment key={quest.id}>
            <QuestCard quest={quest} index={i} onOpenQuest={onOpenQuest} />
            {i < quests.length - 1 && (
              <div className="mx-auto h-8 w-px shrink-0 bg-border" aria-hidden="true" />
            )}
          </Fragment>
        ))}
      </div>
    </section>
  );
}

export function QuestMap({ onOpenQuest }: { onOpenQuest?: (code: string) => void } = {}) {
  const { data, isLoading, isError, refetch } = useQuests();

  if (isLoading) {
    return <LoadingState label="Dépliage de la carte des quêtes…" />;
  }

  if (isError) {
    return <ErrorState message="Impossible de charger la carte des quêtes." onRetry={() => refetch()} />;
  }

  const quests = data?.quests ?? [];

  if (quests.length === 0) {
    return (
      <EmptyState
        title="Aucune quête sur la carte"
        sub="Reviens plus tard : de nouveaux parcours seront tracés pour toi."
        icon={Map}
      />
    );
  }

  const completed = quests.filter((q) => q.status === "COMPLETED");
  const totalXp = quests.reduce((acc, q) => acc + q.xpReward, 0);
  const gainedXp = completed.reduce((acc, q) => acc + q.xpReward, 0);
  const completionPct = Math.round((completed.length / quests.length) * 100);

  const grouped = TRACK_ORDER.map((track) => ({
    track,
    quests: quests.filter((q) => q.track === track),
  })).filter((group) => group.quests.length > 0);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      {/* En-tête + récap */}
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            Carte des Quêtes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Débloque les parcours en progressant. Chaque piste se franchit étape par étape.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard
            icon={CheckCircle2}
            label="Quêtes terminées"
            value={
              <span>
                {completed.length} <span className="text-muted-foreground">/ {quests.length}</span>
              </span>
            }
            sub={`${completionPct} % de la carte explorée`}
          />
          <StatCard
            icon={Zap}
            label="XP des quêtes"
            value={
              <span>
                {formatSats(gainedXp)} <span className="text-muted-foreground">/ {formatSats(totalXp)}</span>
              </span>
            }
            sub="XP cumulés des quêtes terminées"
          />
        </div>

        <Progress value={completionPct} className="h-2" aria-label="Progression globale de la carte" />
      </motion.header>

      {/* Pistes (trails) */}
      <div className="space-y-8">
        {grouped.map((group) => (
          <TrackSection
            key={group.track}
            track={group.track}
            quests={group.quests}
            onOpenQuest={onOpenQuest}
          />
        ))}
      </div>
    </div>
  );
}
