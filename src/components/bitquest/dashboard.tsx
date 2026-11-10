"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Coins,
  Flame,
  GraduationCap,
  Map,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useMe, useQuests } from "@/lib/bitquest/hooks";
import { formatSats } from "@/lib/bitquest/client";
import type { View } from "@/lib/bitquest/store";
import {
  BadgeIcon,
  EmptyState,
  ErrorState,
  LoadingState,
  RewardChips,
  StatCard,
  rarityStyles,
  statusLabels,
  trackStyles,
} from "./ui-bits";
import {
  TRACK_ORDER,
  eventText,
  isNewUser,
  pickNextQuest,
  relativeTime,
} from "./dashboard.utils";
import { DailyChallengeTile } from "./daily-challenge-tile";

/* ============ Helpers visuels (non testables car React) ============ */

function LevelRing({ pct, level }: { pct: number; level: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, pct));
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <div
      className="relative h-24 w-24 shrink-0"
      role="img"
      aria-label={`Niveau ${level}, progression ${Math.round(clamped)} %`}
    >
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        <circle cx="40" cy="40" r={radius} fill="none" strokeWidth="7" className="stroke-muted" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-primary transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display text-lg font-bold leading-none">Nv. {level}</span>
      </div>
    </div>
  );
}

const EVENT_META: Record<string, { icon: LucideIcon; className: string }> = {
  QUEST_COMPLETED: { icon: CheckCircle2, className: "text-emerald-500" },
  BADGE_UNLOCKED: { icon: Trophy, className: "text-amber-500" },
  LEVEL_UP: { icon: TrendingUp, className: "text-primary" },
  SATS_EARNED: { icon: Coins, className: "text-amber-500" },
};

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

/* ============ Sous-composants additifs (Sprint 1A) ============ */

/**
 * D2 — Tuile Académie : lien vers le module Académie (Sprint 1B).
 */
function AcademyTeaser() {
  const titleId = "dashboard-academy-title";
  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.35, delay: 0.18 }}
      aria-labelledby={titleId}
    >
      <Card className="h-full rounded-xl">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <CardTitle
              id={titleId}
              className="flex items-center gap-2 text-base sm:text-lg"
            >
              <GraduationCap className="h-5 w-5 text-primary" aria-hidden />
              Académie BitQuest
            </CardTitle>
            <CardDescription className="mt-1">
              Cours structurés et leçons illustrées pour approfondir Bitcoin au-delà des quêtes.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="shrink-0 border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
          >
            Disponible
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Parcours thématiques, chapitres et leçons pédagogiques — ouvre l&apos;Académie pour
            commencer ou reprendre un cours.
          </p>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/academy">
              Explorer l&apos;Académie
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </motion.section>
  );
}

/**
 * D3 — Bannière d'onboarding pour les comptes tout neufs (0 XP, 0 événement, 0 quête terminée).
 * Rappelle la boucle d'apprentissage avant de laisser l'utilisateur plonger dans la quête Genesis.
 */
function OnboardingBanner({ onStart }: { onStart: () => void }) {
  const titleId = "dashboard-onboarding-title";
  const steps: { icon: LucideIcon; title: string; sub: string }[] = [
    { icon: Sparkles, title: "Lis & valide", sub: "Lis une section et réussis le quiz à 70 %." },
    { icon: Target, title: "Pratique", sub: "Réalise la mission pour ancrer la notion." },
    { icon: Trophy, title: "Récompense", sub: "Gagne XP, badges et sats pédagogiques." },
  ];
  return (
    <motion.section
      {...fadeUp}
      transition={{ duration: 0.35, delay: 0.08 }}
      aria-labelledby={titleId}
    >
      <Card className="rounded-xl border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle id={titleId} className="flex items-center gap-2 text-base sm:text-lg">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden />
            Bienvenue sur BitQuest
          </CardTitle>
          <CardDescription>
            Trois étapes pour chaque quête. Ton aventure commence par la Genèse de Bitcoin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="grid gap-3 sm:grid-cols-3" aria-label="Boucle d'apprentissage">
            {steps.map(({ icon: Icon, title, sub }, i) => (
              <li
                key={title}
                className="flex items-start gap-3 rounded-lg border bg-background/60 p-3"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
                  aria-hidden
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Étape {i + 1}
                  </div>
                  <div className="text-sm font-medium">{title}</div>
                  <div className="text-xs text-muted-foreground">{sub}</div>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex justify-end">
            <Button onClick={onStart} className="w-full sm:w-auto">
              Commencer la quête Genesis
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
}

/* ============ Dashboard ============ */

/**
 * Dashboard — utilisable à la fois en mode SPA (via props onOpenQuest/onNavigate)
 * et en mode routes (sans props : navigation via Link / router.push).
 */
export function Dashboard({
  onOpenQuest,
  onNavigate,
}: {
  onOpenQuest?: (code: string) => void;
  onNavigate?: (view: View) => void;
} = {}) {
  const router = useRouter();
  const openQuest = (code: string) => {
    if (onOpenQuest) onOpenQuest(code);
    else router.push(`/quests/${code}`);
  };
  const navigate = (view: View) => {
    if (onNavigate) onNavigate(view);
    else router.push(`/${view}`);
  };
  const meQuery = useMe();
  const questsQuery = useQuests();

  if (meQuery.isLoading) {
    return <LoadingState label="Chargement de ton tableau de bord…" />;
  }
  if (meQuery.isError || !meQuery.data) {
    return (
      <ErrorState
        message="Impossible de charger ton profil. Vérifie ta connexion."
        onRetry={() => meQuery.refetch()}
      />
    );
  }

  const me = meQuery.data.user;
  const quests = questsQuery.data?.quests ?? [];
  const level = me.levelInfo;
  const completedQuests = quests.filter((q) => q.status === "COMPLETED");
  const totalQuests = quests.length || 11;
  const remaining = totalQuests - completedQuests.length;
  const nextQuest = pickNextQuest(quests);
  const allCompleted = totalQuests > 0 && completedQuests.length === totalQuests;
  const recentBadges = meQuery.data.badges.slice(0, 4);
  const recentEvents = meQuery.data.events.slice(0, 8);

  /** D3 — compte tout neuf : affiche la bannière d'onboarding en plus du Hero. */
  const showOnboarding = isNewUser({
    completedCount: completedQuests.length,
    eventCount: meQuery.data.events.length,
    xp: me.xp,
  });

  /** Code de la première quête disponible pour l'onboarding (toujours Genesis dans le seed actuel). */
  const firstAvailableCode =
    quests.find((q) => q.status === "AVAILABLE" && !q.locked)?.code ?? "genesis";

  /* --- Identifiants pour aria-labelledby (D6) --- */
  const heroId = "dashboard-hero-title";
  const statsId = "dashboard-stats-title";
  const nextQuestId = "dashboard-next-title";
  const tracksId = "dashboard-tracks-title";
  const badgesId = "dashboard-badges-title";
  const activityId = "dashboard-activity-title";

  return (
    <div className="space-y-6">
      {/* ===== Hero ===== */}
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.35 }}
        aria-labelledby={heroId}
      >
        <Card className="rounded-xl">
          <CardContent className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <div className="min-w-0 text-center sm:text-left">
              <h1
                id={heroId}
                className="font-display text-2xl font-bold tracking-tight sm:text-3xl"
              >
                Bonjour, {me.pseudo}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Niv. {level.level} · {level.title}
              </p>
              {!allCompleted && remaining > 0 && !showOnboarding && (
                <p className="mt-2 max-w-md text-sm">
                  {remaining === 1
                    ? "Une quête t'attend encore : chaque victoire rapproche du rang de Maître Satoshi !"
                    : `${remaining} quêtes t'attendent encore : chaque victoire rapproche du rang de Maître Satoshi !`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-5">
              <LevelRing pct={level.pct} level={level.level} />
              <div className="space-y-1 text-sm">
                <div className="font-semibold">
                  {formatSats(me.xp)} XP{" "}
                  <span className="font-normal text-muted-foreground">au total</span>
                </div>
                <div className="text-muted-foreground">
                  {level.next !== null
                    ? `${formatSats(level.needed - level.into)} XP avant Nv. ${level.level + 1}`
                    : "Niveau maximum atteint"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {/* ===== Onboarding (D3 — nouveaux comptes uniquement) ===== */}
      {showOnboarding && <OnboardingBanner onStart={() => openQuest(firstAvailableCode)} />}

      {/* ===== Défi du jour (Phase 2.8) ===== */}
      <DailyChallengeTile />

      {/* ===== StatCards ===== */}
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-labelledby={statsId}
      >
        <h2 id={statsId} className="sr-only">
          Statistiques d&apos;aventurier
        </h2>
        <StatCard icon={Star} label="XP total" value={formatSats(me.xp)} />
        <StatCard
          icon={Map}
          label="Quêtes terminées"
          value={questsQuery.isLoading ? "…" : `${completedQuests.length} / ${totalQuests}`}
        />
        <StatCard icon={Trophy} label="Badges débloqués" value={meQuery.data.badges.length} />
        <StatCard icon={Coins} label="Solde sats" value={`${formatSats(me.sats)} sats`} />
      </motion.section>

      {/* ===== Grille principale ===== */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* --- Colonne gauche --- */}
        <div className="space-y-4 lg:col-span-2">
          {/* Continuer l'apprentissage */}
          <motion.section
            {...fadeUp}
            transition={{ duration: 0.35, delay: 0.1 }}
            aria-labelledby={nextQuestId}
          >
            <Card className="h-full rounded-xl">
              <CardHeader>
                <CardTitle id={nextQuestId}>Continuer l&apos;apprentissage</CardTitle>
                <CardDescription>Ta prochaine étape sur le chemin de Bitcoin.</CardDescription>
              </CardHeader>
              <CardContent>
                {nextQuest ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={trackStyles[nextQuest.track]?.badge}>
                        {trackStyles[nextQuest.track]?.label ?? nextQuest.track}
                      </Badge>
                      <Badge variant="outline" className="text-muted-foreground">
                        {statusLabels[nextQuest.status] ?? nextQuest.status}
                      </Badge>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{nextQuest.title}</h3>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {nextQuest.subtitle}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <RewardChips xp={nextQuest.xpReward} sats={nextQuest.satsReward} />
                      <Button
                        size="lg"
                        className="h-10 w-full sm:w-auto"
                        onClick={() => openQuest(nextQuest.code)}
                      >
                        {nextQuest.status === "AVAILABLE" ? "Commencer" : "Reprendre"} :{" "}
                        {nextQuest.title}
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                ) : allCompleted ? (
                  <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <Sparkles className="h-8 w-8 text-primary" aria-hidden />
                    <p className="font-semibold">Toutes les quêtes terminées, Maître Satoshi !</p>
                    <p className="text-sm text-muted-foreground">
                      Tu maîtrises désormais les fondamentaux de Bitcoin et du Lightning Network.
                      Compare ton XP aux autres aventuriers.
                    </p>
                    <Button size="lg" className="h-10" onClick={() => navigate("leaderboard")}>
                      Voir le classement
                      <Trophy className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <p className="font-medium">Aucune quête accessible pour l&apos;instant.</p>
                    <p className="text-sm text-muted-foreground">
                      Continue de gagner de l&apos;XP pour débloquer la suite du parcours.
                    </p>
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-10"
                      onClick={() => navigate("leaderboard")}
                    >
                      Voir le classement
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.section>

          {/* Progression par parcours */}
          <motion.section
            {...fadeUp}
            transition={{ duration: 0.35, delay: 0.15 }}
            aria-labelledby={tracksId}
          >
            <Card className="h-full rounded-xl">
              <CardHeader>
                <CardTitle id={tracksId}>Progression par parcours</CardTitle>
                <CardDescription>
                  Quatre pistes, de l&apos;initiation aux événements spéciaux.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {TRACK_ORDER.map((track) => {
                  const style = trackStyles[track];
                  const trackQuests = quests.filter((q) => q.track === track);
                  const done = trackQuests.filter((q) => q.status === "COMPLETED").length;
                  const total = trackQuests.length;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  return (
                    <div key={track} className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={`w-28 justify-center shrink-0 ${style?.badge ?? ""}`}
                      >
                        {style?.label ?? track}
                      </Badge>
                      <Progress
                        value={pct}
                        className="h-2 flex-1"
                        aria-label={`Progression ${style?.label ?? track} : ${pct} %`}
                      />
                      <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
                        {done}/{total}
                      </span>
                    </div>
                  );
                })}
                {quests.length === 0 && (
                  <p className="text-sm text-muted-foreground">Les quêtes se chargent…</p>
                )}
              </CardContent>
            </Card>
          </motion.section>

          {/* D2 — Tuile Académie "Bientôt disponible" */}
          <AcademyTeaser />
        </div>

        {/* --- Colonne droite --- */}
        <div className="space-y-4">
          {/* Badges récents */}
          <motion.section
            {...fadeUp}
            transition={{ duration: 0.35, delay: 0.2 }}
            aria-labelledby={badgesId}
          >
            <Card className="h-full rounded-xl">
              <CardHeader>
                <CardTitle id={badgesId}>Badges récents</CardTitle>
                <CardDescription>Tes dernières récompenses de collectionneur.</CardDescription>
              </CardHeader>
              <CardContent>
                {recentBadges.length > 0 ? (
                  <ul className="space-y-3">
                    {recentBadges.map((badge) => {
                      const rarity = rarityStyles[badge.rarity];
                      return (
                        <li key={badge.code} className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <BadgeIcon icon={badge.icon} className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">{badge.name}</div>
                          </div>
                          <Badge
                            variant="outline"
                            className={`shrink-0 ${rarity?.badge ?? rarityStyles.COMMON.badge}`}
                          >
                            {rarity?.label ?? "Commun"}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="space-y-3">
                    <EmptyState
                      icon={Trophy}
                      title="Aucun badge pour l'instant"
                      sub="Complète ta première quête !"
                    />
                    <div className="text-center">
                      <Button
                        variant="link"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => navigate("quests")}
                      >
                        Aller vers les quêtes
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.section>

          {/* Activité récente */}
          <motion.section
            {...fadeUp}
            transition={{ duration: 0.35, delay: 0.25 }}
            aria-labelledby={activityId}
          >
            <Card className="h-full rounded-xl">
              <CardHeader>
                <CardTitle id={activityId}>Activité récente</CardTitle>
                <CardDescription>Le journal de ton aventure.</CardDescription>
              </CardHeader>
              <CardContent>
                {recentEvents.length > 0 ? (
                  <ul
                    className="max-h-64 space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar]:w-1.5"
                    aria-live="polite"
                    aria-label="Journal d'activité"
                  >
                    {recentEvents.map((event, i) => {
                      const meta = EVENT_META[event.type];
                      const Icon = meta?.icon ?? Sparkles;
                      return (
                        <li
                          key={`${event.type}-${event.createdAt}-${i}`}
                          className="flex items-start gap-3"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <Icon
                              className={`h-4 w-4 ${meta?.className ?? "text-muted-foreground"}`}
                              aria-hidden
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-snug">{eventText(event)}</p>
                            <p className="text-xs text-muted-foreground">
                              {relativeTime(event.createdAt)}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Aucune activité pour l&apos;instant — lance-toi sur une quête, l&apos;histoire
                    s&apos;écrit avec toi.
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.section>
        </div>
      </div>

      {/* Rappel streak discret */}
      {me.streak > 0 && (
        <motion.p
          {...fadeUp}
          transition={{ duration: 0.35, delay: 0.3 }}
          className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"
        >
          <Flame className="h-3.5 w-3.5 text-orange-500" aria-hidden />
          Série d&apos;activité : {me.streak} jour{me.streak > 1 ? "s" : ""} — reviens demain pour
          un bonus accru.
        </motion.p>
      )}
    </div>
  );
}
