"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Coins,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Info,
  ListChecks,
  Loader2,
  Lock,
  Map,
  PartyPopper,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { api, formatSats } from "@/lib/bitquest/client";
import type {
  BadgeNotification,
  MissionSubmitResponse,
  QuestDetail,
  QuizResult,
  QuizSubmitResponse,
} from "@/lib/bitquest/client";
import { useInvalidateAll, useQuestDetail } from "@/lib/bitquest/hooks";
import { useBitQuest } from "@/lib/bitquest/store";
import {
  BadgeIcon,
  EmptyState,
  ErrorState,
  LoadingState,
  ProofChips,
  RewardChips,
  rarityStyles,
  trackStyles,
} from "./ui-bits";
import { MissionPanel } from "./mission-panel";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

/* ============ Types locaux ============ */

type Step = "intro" | "theory" | "quiz" | "mission" | "rewards";

type Quest = QuestDetail["quest"];
type QuestProgress = QuestDetail["progress"];
type QuizQuestion = QuestDetail["quiz"][number];

const STEPS: { key: Step; label: string }[] = [
  { key: "intro", label: "Introduction" },
  { key: "theory", label: "Théorie" },
  { key: "quiz", label: "Quiz" },
  { key: "mission", label: "Mission" },
  { key: "rewards", label: "Récompenses" },
];

const QUIZ_PASS_THRESHOLD = 70;

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

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Une erreur est survenue. Réessaie.";
}

function notifyBadges(
  toast: ReturnType<typeof useToast>["toast"],
  badges: BadgeNotification[] | undefined
) {
  badges?.forEach((b) => {
    toast({
      title: `Badge débloqué : ${b.name}`,
      description: (
        <span className="flex items-center gap-2">
          <BadgeIcon icon={b.icon} className="h-4 w-4 shrink-0 text-amber-500" />
          <span>{b.description}</span>
        </span>
      ),
    });
  });
}

function userAnswerLabel(q: QuizQuestion, a: number | boolean | null): string {
  if (a === null || a === undefined) return "—";
  if (q.type === "TRUE_FALSE") return a ? "Vrai" : "Faux";
  if (typeof a === "boolean") return "—";
  return q.options[Number(a)] ?? "—";
}

function correctAnswerLabel(q: QuizQuestion, r: QuizResult): string {
  if (q.type === "TRUE_FALSE") return r.correctBool ? "Vrai" : "Faux";
  return q.options[r.correctIndex ?? -1] ?? "—";
}

/* ============ Étape 1 : Introduction ============ */

function IntroStep({ quest, onStart }: { quest: Quest; onStart: () => void }) {
  const paragraphs = quest.intro.split("\n\n").filter(Boolean);
  const objectives = quest.theorySections.map((s) => s.title);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4 sm:p-6">
          <h2 className="flex items-center gap-2 font-bold">
            <GraduationCap className="h-4 w-4 text-primary" />
            Objectifs pédagogiques
          </h2>
          <ul className="space-y-2">
            {objectives.map((o) => (
              <li key={o} className="flex items-start gap-2 text-sm">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="h-10" onClick={onStart}>
          Commencer l&apos;apprentissage
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ============ Étape 2 : Théorie ============ */

function TheoryStep({
  quest,
  sectionIndex,
  reading,
  onRead,
  onBack,
}: {
  quest: Quest;
  sectionIndex: number;
  reading: boolean;
  onRead: () => void;
  onBack: () => void;
}) {
  const sections = quest.theorySections;
  const section = sections[sectionIndex];
  if (!section) return null;

  const isLast = sectionIndex >= sections.length - 1;
  const paragraphs = section.body.split("\n\n").filter(Boolean);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Section {sectionIndex + 1} sur {sections.length}
              </span>
              <span className="inline-flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" />
                {quest.title}
              </span>
            </div>
            <Progress value={((sectionIndex + 1) / sections.length) * 100} className="h-1.5" />
          </div>

          <h2 className="text-lg font-bold leading-snug">{section.title}</h2>

          <div className="space-y-3">
            {paragraphs.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
          </div>

          {section.keypoints.length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">Points clés</div>
              <ul className="space-y-2">
                {section.keypoints.map((k) => (
                  <li key={k} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{k}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          className="h-10"
          onClick={onBack}
          disabled={sectionIndex === 0 || reading}
        >
          <ArrowLeft className="h-4 w-4" />
          Section précédente
        </Button>
        <Button className="h-10" onClick={onRead} disabled={reading}>
          {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {isLast ? "Passer au quiz" : "J'ai lu cette section"}
        </Button>
      </div>
    </div>
  );
}

/* ============ Étape 3 : Quiz ============ */

function QuizQuestionCard({
  question,
  index,
  total,
  answer,
  onSelect,
  answeredCount,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  answer: number | boolean | null;
  onSelect: (value: number | boolean) => void;
  answeredCount: number;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Question {index + 1} sur {total}
            </span>
            <span>
              {answeredCount}/{total} répondues
            </span>
          </div>
          <Progress value={(answeredCount / total) * 100} className="h-1.5" />
        </div>

        <Badge variant="outline" className="border-primary/40 text-primary">
          {question.type === "TRUE_FALSE" ? "Vrai ou faux" : "QCM"}
        </Badge>

        <h2 className="text-base font-semibold leading-relaxed sm:text-lg">{question.question}</h2>

        {question.type === "TRUE_FALSE" ? (
          <div className="grid grid-cols-2 gap-3">
            {[true, false].map((v) => (
              <Button
                key={String(v)}
                type="button"
                variant="outline"
                className={cn(
                  "h-14 text-base",
                  answer === v && "border-primary/60 bg-primary/10 text-primary hover:bg-primary/15"
                )}
                onClick={() => onSelect(v)}
              >
                {v ? "Vrai" : "Faux"}
              </Button>
            ))}
          </div>
        ) : (
          <RadioGroup
            value={typeof answer === "number" ? String(answer) : ""}
            onValueChange={(v) => onSelect(Number(v))}
          >
            {question.options.map((opt, oi) => (
              <Label
                key={oi}
                htmlFor={`bq-quiz-${index}-opt-${oi}`}
                className={cn(
                  "min-h-10 cursor-pointer items-center justify-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                  answer === oi ? "border-primary/50 bg-primary/5" : "hover:bg-accent/40"
                )}
              >
                <RadioGroupItem id={`bq-quiz-${index}-opt-${oi}`} value={String(oi)} />
                <span className="text-sm">{opt}</span>
              </Label>
            ))}
          </RadioGroup>
        )}
      </CardContent>
    </Card>
  );
}

function QuizResults({
  quiz,
  answers,
  result,
  onRetry,
  onGoMission,
}: {
  quiz: QuizQuestion[];
  answers: (number | boolean | null)[];
  result: QuizSubmitResponse;
  onRetry: () => void;
  onGoMission: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4 text-center sm:p-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 16 }}
          >
            <div
              className={cn(
                "font-display text-5xl font-bold sm:text-6xl",
                result.passed ? "text-emerald-500" : "text-rose-500"
              )}
            >
              {result.score}
              <span className="text-2xl text-muted-foreground">/100</span>
            </div>
          </motion.div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge
              className={
                result.passed ? "border-transparent bg-emerald-500 text-white" : "border-transparent bg-rose-500 text-white"
              }
            >
              {result.passed ? "Quiz réussi" : "Quiz échoué"}
            </Badge>
            {result.perfect && (
              <Badge className="gap-1 border-transparent bg-amber-500 text-white">
                <Sparkles className="h-3 w-3" />
                Score parfait
              </Badge>
            )}
          </div>

          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {result.passed
              ? "Réussite minimale 70 % atteinte — la mission BitLab est débloquée."
              : "Il te faut au moins 70 % pour débloquer la mission BitLab. Lis les corrections ci-dessous, puis retente ta chance."}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {result.passed ? (
              <Button className="h-10" onClick={onGoMission}>
                <FlaskConical className="h-4 w-4" />
                Aller à la mission
              </Button>
            ) : (
              <Button variant="outline" className="h-10" onClick={onRetry}>
                <RotateCcw className="h-4 w-4" />
                Repasser le quiz
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4 sm:p-6">
          <h3 className="font-bold">Correction détaillée</h3>
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {result.results.map((r) => {
              const q = quiz[r.index];
              if (!q) return null;
              return (
                <div
                  key={r.index}
                  className={cn(
                    "space-y-2 rounded-xl border p-3",
                    r.isCorrect ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {r.isCorrect ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    )}
                    <div className="min-w-0 space-y-1.5">
                      <p className="text-sm font-medium leading-snug">{q.question}</p>
                      <p className="text-xs text-muted-foreground">
                        Ta réponse :{" "}
                        <span className={r.isCorrect ? "font-semibold text-emerald-500" : "font-semibold text-rose-500"}>
                          {userAnswerLabel(q, answers[r.index] ?? null)}
                        </span>
                        {!r.isCorrect && (
                          <>
                            {" — "}
                            Bonne réponse :{" "}
                            <span className="font-semibold text-emerald-500">{correctAnswerLabel(q, r)}</span>
                          </>
                        )}
                      </p>
                      <p className="rounded-lg bg-muted p-2.5 text-xs leading-relaxed text-muted-foreground">
                        {r.explanation}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function QuizStep({
  quiz,
  answers,
  result,
  submitting,
  current,
  setCurrent,
  onSelect,
  onSubmit,
  onRetry,
  onGoMission,
}: {
  quiz: QuizQuestion[];
  answers: (number | boolean | null)[] | null;
  result: QuizSubmitResponse | null;
  submitting: boolean;
  current: number;
  setCurrent: (index: number) => void;
  onSelect: (index: number, value: number | boolean) => void;
  onSubmit: () => void;
  onRetry: () => void;
  onGoMission: () => void;
}) {
  if (quiz.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Aucun quiz disponible pour cette quête.
        </CardContent>
      </Card>
    );
  }

  if (result) {
    return (
      <QuizResults
        quiz={quiz}
        answers={answers ?? []}
        result={result}
        onRetry={onRetry}
        onGoMission={onGoMission}
      />
    );
  }

  const index = Math.min(Math.max(current, 0), quiz.length - 1);
  const question = quiz[index];
  const answeredCount = answers ? answers.filter((a) => a !== null).length : 0;
  const allAnswered = answers !== null && answers.every((a) => a !== null);
  const isLast = index >= quiz.length - 1;

  return (
    <div className="space-y-4">
      <QuizQuestionCard
        question={question}
        index={index}
        total={quiz.length}
        answer={answers ? (answers[index] ?? null) : null}
        onSelect={(v) => onSelect(index, v)}
        answeredCount={answeredCount}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" className="h-10" onClick={() => setCurrent(index - 1)} disabled={index === 0}>
          <ArrowLeft className="h-4 w-4" />
          Précédent
        </Button>
        {!isLast ? (
          <Button className="h-10" onClick={() => setCurrent(index + 1)} disabled={answers?.[index] == null}>
            Suivant
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button className="h-10" onClick={onSubmit} disabled={!allAnswered || submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
            Valider mes réponses
          </Button>
        )}
      </div>

      {!allAnswered && (
        <p className="text-center text-xs text-muted-foreground">
          Réponds aux {quiz.length} questions pour valider le quiz.
        </p>
      )}
    </div>
  );
}

/* ============ Étape 4 : Mission BitLab ============ */

function MissionStep({
  quest,
  missionMeta,
  progress,
  challenge,
  attemptsLeft,
  lastFeedback,
  starting,
  submitting,
  onLaunch,
  onSubmit,
  onFinish,
}: {
  quest: Quest;
  missionMeta: QuestDetail["missionMeta"];
  progress: QuestProgress;
  challenge: Record<string, unknown> | null;
  attemptsLeft: number;
  lastFeedback: { success: boolean; feedback: string } | null;
  starting: boolean;
  submitting: boolean;
  onLaunch: () => void;
  onSubmit: (answer: Record<string, unknown>) => void;
  onFinish: () => void;
}) {
  const alreadyCompleted = progress?.status === "COMPLETED" && progress?.missionProof != null;

  if (alreadyCompleted) {
    return (
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex items-center gap-2 text-emerald-500">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-bold">Quête déjà complétée</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Tu as déjà validé cette mission BitLab. Voici la preuve enregistrée :
          </p>
          <ProofChips proof={progress?.missionProof ?? null} />
          <p className="text-xs text-muted-foreground">Preuve enregistrée côté serveur (BitLab).</p>
          <RewardChips xp={quest.xpReward} sats={quest.satsReward} />
          <div>
            <Button className="h-10" onClick={onFinish}>
              Terminer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (challenge) {
    return (
      <MissionPanel
        missionType={quest.missionType}
        challenge={challenge}
        brief={missionMeta.brief}
        hint={missionMeta.hint}
        attemptsLeft={attemptsLeft}
        submitting={submitting}
        lastFeedback={lastFeedback}
        onSubmit={onSubmit}
      />
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FlaskConical className="h-5 w-5" />
          </span>
          <div>
            <div className="font-bold">Mission BitLab</div>
            <div className="text-xs text-muted-foreground">Exercice pratique validé côté serveur</div>
          </div>
        </div>

        {missionMeta.brief && (
          <p className="text-sm leading-relaxed text-muted-foreground">{missionMeta.brief}</p>
        )}

        <div>
          <Button className="h-10" onClick={onLaunch} disabled={starting}>
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            Lancer la mission dans BitLab
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Le défi est généré côté serveur : les réponses attendues ne quittent jamais BitLab. Les tentatives sont
          limitées, prends ton temps.
        </p>
      </CardContent>
    </Card>
  );
}

/* ============ Étape 5 : Récompenses ============ */

function RewardsStep({
  questTitle,
  rewards,
  onBackToMap,
  onDashboard,
}: {
  questTitle: string;
  rewards: MissionSubmitResponse;
  onBackToMap: () => void;
  onDashboard: () => void;
}) {
  const sats = rewards.sats;

  const particles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        left: 6 + ((i * 37) % 88),
        delay: (i % 6) * 0.18,
        drift: ((i % 5) - 2) * 16,
        duration: 1.8 + (i % 3) * 0.35,
        color: ["bg-primary", "bg-amber-500", "bg-emerald-500", "bg-violet-500"][i % 4],
      })),
    []
  );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
      >
        <div className="relative overflow-hidden rounded-xl border bg-card p-6 text-center sm:p-10">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {particles.map((p, i) => (
              <motion.span
                key={i}
                className={cn("absolute h-1.5 w-1.5 rounded-full", p.color)}
                style={{ left: `${p.left}%`, bottom: "-8px" }}
                animate={{ y: [0, -230], x: [0, p.drift], opacity: [1, 1, 0], scale: [1, 0.6] }}
                transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "easeOut" }}
              />
            ))}
          </div>
          <motion.div
            initial={{ rotate: -12, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 14 }}
          >
            <PartyPopper className="mx-auto h-12 w-12 text-primary" />
          </motion.div>
          <h2 className="mt-3 font-display text-2xl font-black tracking-tight sm:text-3xl">Quête complétée !</h2>
          <p className="mt-1 text-sm text-muted-foreground">{questTitle} — bravo, aventurier.</p>
        </div>
      </motion.div>

      {rewards.feedback && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <AlertTitle>Feedback de la mission</AlertTitle>
          <AlertDescription>{rewards.feedback}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <RewardChips xp={rewards.xp?.xpGained} />
            {rewards.bonusXp?.xpGained ? (
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                +{rewards.bonusXp.xpGained} XP · bonus de complétion
              </Badge>
            ) : null}
          </div>

          {sats && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Coins className="h-4 w-4 shrink-0 text-amber-500" />
                <span>
                  Tu reçois <span className="font-bold text-amber-500">{formatSats(sats.granted)} sats</span>
                  {sats.streakBonus > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      — dont {formatSats(sats.streakBonus)} de bonus streak (+{sats.streakBonusPct} %)
                    </span>
                  )}
                </span>
              </div>
              {sats.capped && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Plafond journalier</AlertTitle>
                  <AlertDescription>
                    Plafond journalier de 10 000 sats atteint — le surplus sera de nouveau disponible demain.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {rewards.proof && (
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">Preuve enregistrée côté serveur (BitLab)</div>
              <ProofChips proof={rewards.proof} />
            </div>
          )}

          {rewards.badges && rewards.badges.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-bold">Badges débloqués</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {rewards.badges.map((b) => {
                  const rarity = rarityStyles[b.rarity] ?? { label: b.rarity, badge: "", glow: "" };
                  return (
                    <div
                      key={b.code}
                      className={cn("flex items-center gap-3 rounded-xl border bg-card p-3", rarity.glow)}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                        <BadgeIcon icon={b.icon} className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 space-y-0.5">
                        <div className="truncate text-sm font-semibold">{b.name}</div>
                        <Badge variant="outline" className={cn("text-[10px]", rarity.badge)}>
                          {rarity.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <Button variant="outline" className="h-10 flex-1" onClick={onBackToMap}>
              Retour à la carte
            </Button>
            <Button className="h-10 flex-1" onClick={onDashboard}>
              <Trophy className="h-4 w-4" />
              Tableau de bord
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============ Composant principal ============ */

export function QuestPlayer({
  code,
  onExit,
  onCompleted,
}: {
  code: string;
  onExit: () => void;
  onCompleted: () => void;
}) {
  const { toast } = useToast();
  const invalidateAll = useInvalidateAll();
  const setView = useBitQuest((s) => s.setView);
  const { data: detail, isLoading, isError, refetch } = useQuestDetail(code);

  const [step, setStep] = useState<Step>("intro");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [sectionsRead, setSectionsRead] = useState(0);
  const [quizBest, setQuizBest] = useState(0);
  const [answers, setAnswers] = useState<(number | boolean | null)[] | null>(null);
  const [quizQuestion, setQuizQuestion] = useState(0);
  const [quizResult, setQuizResult] = useState<QuizSubmitResponse | null>(null);
  const [challenge, setChallenge] = useState<Record<string, unknown> | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(0);
  const [lastFeedback, setLastFeedback] = useState<{ success: boolean; feedback: string } | null>(null);
  const [rewards, setRewards] = useState<MissionSubmitResponse | null>(null);

  const startedRef = useRef(false);
  const [hydratedCode, setHydratedCode] = useState<string | null>(null);

  /* Le composant est remonté via key={code} dans page.tsx — pas besoin de reset manuel */

  /* Démarrage de la quête côté serveur (une seule fois, fire-and-forget) */
  useEffect(() => {
    if (!code || startedRef.current) return;
    startedRef.current = true;
    api.startQuest(code).catch(() => {});
  }, [code]);

  const quest = detail?.quest ?? null;
  const quiz = detail?.quiz ?? [];
  const progress = detail?.progress ?? null;

  /* Hydratation de la progression locale depuis le serveur (render-phase update) */
  if (detail && hydratedCode !== code) {
    setHydratedCode(code);
    const p = detail.progress;
    if (p) {
      setSectionsRead(p.sectionsRead);
      setQuizBest(p.quizBestScore);
      if (p.sectionsRead > 0) {
        setSectionIndex(Math.min(p.sectionsRead, detail.quest.theorySections.length - 1));
      }
    }
  }

  /* Réponses du quiz initialisées au premier rendu disponible (render-phase update) */
  if (answers === null && quiz.length > 0) {
    setAnswers(Array(quiz.length).fill(null));
  }

  const theoryDone = quest ? sectionsRead >= quest.theorySections.length : false;
  const quizPassed = quizBest >= QUIZ_PASS_THRESHOLD;
  const completed = progress?.status === "COMPLETED" || rewards !== null;

  /* ---------- Mutations ---------- */

  const readSectionMutation = useMutation({
    mutationFn: (index: number) => api.readSection(code, index),
    onSuccess: (res, index) => {
      setSectionsRead((prev) => Math.max(prev, index + 1));
      if (res.xp) {
        toast({ title: `+${res.xp.xpGained} XP`, description: "Section étudiée, continue comme ça." });
      }
      const total = quest?.theorySections.length ?? 0;
      if (index + 1 >= total) {
        setStep("quiz");
      } else {
        setSectionIndex(index + 1);
      }
    },
    onError: (err) => toast({ variant: "destructive", title: "Erreur", description: errorMessage(err) }),
  });

  const quizSubmitMutation = useMutation({
    mutationFn: (payload: (number | boolean)[]) => api.quizSubmit(code, payload),
    onSuccess: (res) => {
      setQuizResult(res);
      setQuizBest((prev) => Math.max(prev, res.score));
      if (res.xp) {
        toast({ title: `+${res.xp.xpGained} XP`, description: "Quiz validé, bien joué." });
      }
      notifyBadges(toast, res.badges);
      invalidateAll();
    },
    onError: (err) => toast({ variant: "destructive", title: "Erreur", description: errorMessage(err) }),
  });

  const missionStartMutation = useMutation({
    mutationFn: () => api.missionStart(code),
    onSuccess: (res) => {
      setChallenge(res.challenge);
      setAttemptsLeft(res.attemptsLeft);
      setLastFeedback(null);
    },
    onError: (err) => toast({ variant: "destructive", title: "Erreur", description: errorMessage(err) }),
  });

  const missionSubmitMutation = useMutation({
    mutationFn: (answer: Record<string, unknown>) => api.missionSubmit(code, answer),
    onSuccess: (res) => {
      if (res.success) {
        setRewards(res);
        setChallenge(null);
        setLastFeedback(null);
        setStep("rewards");
        invalidateAll();
        if (res.xp?.xpGained) {
          toast({ title: `+${res.xp.xpGained} XP`, description: "Mission BitLab réussie." });
        }
        if (res.bonusXp?.xpGained) {
          toast({ title: `+${res.bonusXp.xpGained} XP`, description: "Bonus de complétion de quête." });
        }
        if (res.sats && res.sats.granted > 0) {
          toast({
            title: `+${formatSats(res.sats.granted)} sats`,
            description: res.sats.capped
              ? "Plafond journalier de 10 000 sats atteint."
              : "Récompense versée dans ton wallet.",
          });
        }
        notifyBadges(toast, res.badges);
      } else {
        setLastFeedback({ success: false, feedback: res.feedback });
        if (typeof res.attemptsLeft === "number") {
          setAttemptsLeft(res.attemptsLeft);
        } else {
          setAttemptsLeft((prev) => Math.max(0, prev - 1));
        }
      }
    },
    onError: (err) => toast({ variant: "destructive", title: "Erreur", description: errorMessage(err) }),
  });

  /* ---------- Handlers ---------- */

  const handleQuizSelect = (index: number, value: number | boolean) => {
    setAnswers((prev) => (prev ? prev.map((a, i) => (i === index ? value : a)) : prev));
  };

  const submitQuiz = () => {
    if (!answers || !answers.every((a) => a !== null)) return;
    quizSubmitMutation.mutate(answers as (number | boolean)[]);
  };

  const retryQuiz = () => {
    setQuizResult(null);
    setQuizQuestion(0);
    setAnswers(Array(quiz.length).fill(null));
  };

  /* ---------- Déblocage des étapes ---------- */

  const unlocked: Record<Step, boolean> = {
    intro: true,
    theory: true,
    quiz: theoryDone || quizBest > 0,
    mission: quizPassed,
    rewards: completed,
  };

  const doneFlags: Record<Step, boolean> = {
    intro: step !== "intro",
    theory: theoryDone,
    quiz: quizPassed,
    mission: completed,
    rewards: completed,
  };

  /* ---------- Rendu ---------- */

  if (isLoading) {
    return <LoadingState label="Préparation du parcours…" />;
  }

  if (isError) {
    return <ErrorState message="Impossible de charger cette quête." onRetry={() => refetch()} />;
  }

  if (!quest) {
    return (
      <EmptyState
        title="Quête introuvable"
        sub="Retourne à la carte et sélectionne une quête disponible."
        icon={Map}
      />
    );
  }

  const ts = getTrackStyle(quest.track);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      {/* Retour */}
      <div>
        <Button variant="ghost" className="h-10 gap-2" onClick={onExit}>
          <ArrowLeft className="h-4 w-4" />
          Carte des quêtes
        </Button>
      </div>

      {/* En-tête de quête */}
      <header className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">{quest.title}</h1>
          <Badge variant="outline" className={cn("gap-1.5", ts.badge)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", ts.dot)} />
            {ts.label}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm text-muted-foreground">{quest.subtitle}</span>
          <RewardChips xp={quest.xpReward} sats={quest.satsReward} />
        </div>
      </header>

      {/* Stepper */}
      <ol className="flex items-center overflow-x-auto pb-1" aria-label="Étapes de la quête">
        {STEPS.map((s, i) => {
          const isCurrent = s.key === step;
          const isDone = doneFlags[s.key];
          const isUnlocked = unlocked[s.key];
          return (
            <li key={s.key} className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => setStep(s.key)}
                disabled={!isUnlocked || isCurrent}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-full px-3 text-xs font-medium transition-colors",
                  isCurrent
                    ? "bg-primary/15 text-primary"
                    : isUnlocked
                      ? "text-muted-foreground hover:bg-accent"
                      : "cursor-not-allowed text-muted-foreground/50"
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                    isCurrent
                      ? "border-primary bg-primary text-primary-foreground"
                      : isDone && !isCurrent
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-500"
                        : isUnlocked
                          ? "border-border"
                          : "border-border/60 text-muted-foreground/60"
                  )}
                >
                  {isDone && !isCurrent ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : isUnlocked ? (
                    i + 1
                  ) : (
                    <Lock className="h-3 w-3" />
                  )}
                </span>
                <span className="whitespace-nowrap">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <span className="mx-1 h-px w-5 shrink-0 bg-border sm:w-8" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>

      {/* Contenu de l'étape */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {step === "intro" && <IntroStep quest={quest} onStart={() => setStep("theory")} />}

          {step === "theory" && (
            <TheoryStep
              quest={quest}
              sectionIndex={sectionIndex}
              reading={readSectionMutation.isPending}
              onRead={() => readSectionMutation.mutate(sectionIndex)}
              onBack={() => setSectionIndex((i) => Math.max(0, i - 1))}
            />
          )}

          {step === "quiz" && (
            <QuizStep
              quiz={quiz}
              answers={answers}
              result={quizResult}
              submitting={quizSubmitMutation.isPending}
              current={quizQuestion}
              setCurrent={setQuizQuestion}
              onSelect={handleQuizSelect}
              onSubmit={submitQuiz}
              onRetry={retryQuiz}
              onGoMission={() => setStep("mission")}
            />
          )}

          {step === "mission" && (
            <MissionStep
              quest={quest}
              missionMeta={detail?.missionMeta ?? { brief: null, hint: null }}
              progress={progress}
              challenge={challenge}
              attemptsLeft={attemptsLeft}
              lastFeedback={lastFeedback}
              starting={missionStartMutation.isPending}
              submitting={missionSubmitMutation.isPending}
              onLaunch={() => missionStartMutation.mutate()}
              onSubmit={(answer) => missionSubmitMutation.mutate(answer)}
              onFinish={onCompleted}
            />
          )}

          {step === "rewards" && rewards && (
            <RewardsStep
              questTitle={quest.title}
              rewards={rewards}
              onBackToMap={onCompleted}
              onDashboard={() => {
                setView("dashboard");
                onCompleted();
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
