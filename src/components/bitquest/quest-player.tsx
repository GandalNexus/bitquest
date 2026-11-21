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
  Zap,
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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toBitlabKind, type BitlabKind } from "@/lib/bitlab/mission-kinds";
import { parseBitlabReturn } from "@/lib/bitlab/deep-link";
import { useAppendTheme } from "@/lib/theme-sync";
import { useT } from "@/i18n/locale-provider";

/* ============ Types locaux ============ */

type Step = "intro" | "theory" | "quiz" | "mission" | "rewards";
type Translator = (key: string, vars?: Record<string, string | number>) => string;

type Quest = QuestDetail["quest"];
type QuestProgress = QuestDetail["progress"];
type QuizQuestion = QuestDetail["quiz"][number];

const STEP_KEYS: { key: Step; labelKey: string }[] = [
  { key: "intro", labelKey: "player.step.intro" },
  { key: "theory", labelKey: "player.step.theory" },
  { key: "quiz", labelKey: "player.step.quiz" },
  { key: "mission", labelKey: "player.step.mission" },
  { key: "rewards", labelKey: "player.step.rewards" },
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

function errorMessage(err: unknown, t: Translator): string {
  return err instanceof Error ? err.message : t("player.toast.error.unknown");
}

function notifyBadges(
  toast: ReturnType<typeof useToast>["toast"],
  t: Translator,
  badges: BadgeNotification[] | undefined,
) {
  if (!badges) return;
  for (const b of badges) {
    toast({
      title: t("player.toast.badge.title", { name: b.name }),
      description: (
        <span className="flex items-center gap-2">
          <BadgeIcon icon={b.icon} className="h-4 w-4 shrink-0 text-amber-500" />
          <span>{b.description}</span>
        </span>
      ),
    });
  }
}

function userAnswerLabel(q: QuizQuestion, a: number | boolean | null, t: Translator): string {
  if (a === null || a === undefined) return "—";
  if (q.type === "TRUE_FALSE") return a ? t("quiz.answer.true") : t("quiz.answer.false");
  if (typeof a === "boolean") return "—";
  return q.options[Number(a)] ?? "—";
}

function correctAnswerLabel(q: QuizQuestion, r: QuizResult, t: Translator): string {
  if (q.type === "TRUE_FALSE") return r.correctBool ? t("quiz.answer.true") : t("quiz.answer.false");
  return q.options[r.correctIndex ?? -1] ?? "—";
}

/* ============ Étape 1 : Introduction ============ */

function IntroStep({ quest, onStart, t }: { quest: Quest; onStart: () => void; t: Translator }) {
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
            {t("intro.objectives")}
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
          {t("intro.start")}
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
  t,
}: {
  quest: Quest;
  sectionIndex: number;
  reading: boolean;
  onRead: () => void;
  onBack: () => void;
  t: Translator;
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
                {t("theory.section.count", { current: sectionIndex + 1, total: sections.length })}
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
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                {t("theory.keypoints")}
              </div>
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
        <Button variant="ghost" className="h-10" onClick={onBack} disabled={sectionIndex === 0 || reading}>
          <ArrowLeft className="h-4 w-4" />
          {t("theory.previous")}
        </Button>
        <Button className="h-10" onClick={onRead} disabled={reading}>
          {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {isLast ? t("theory.goToQuiz") : t("theory.readConfirmed")}
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
  t,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  answer: number | boolean | null;
  onSelect: (value: number | boolean) => void;
  answeredCount: number;
  t: Translator;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{t("quiz.question.count", { current: index + 1, total })}</span>
            <span>{t("quiz.answered.count", { answered: answeredCount, total })}</span>
          </div>
          <Progress value={(answeredCount / total) * 100} className="h-1.5" />
        </div>

        <Badge variant="outline" className="border-primary/40 text-primary">
          {question.type === "TRUE_FALSE" ? t("quiz.type.trueFalse") : t("quiz.type.mcq")}
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
                  answer === v && "border-primary/60 bg-primary/10 text-primary hover:bg-primary/15",
                )}
                onClick={() => onSelect(v)}
              >
                {v ? t("quiz.answer.true") : t("quiz.answer.false")}
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
                  answer === oi ? "border-primary/50 bg-primary/5" : "hover:bg-accent/40",
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
  t,
}: {
  quiz: QuizQuestion[];
  answers: (number | boolean | null)[];
  result: QuizSubmitResponse;
  onRetry: () => void;
  onGoMission: () => void;
  t: Translator;
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
                result.passed ? "text-emerald-500" : "text-rose-500",
              )}
            >
              {result.score}
              <span className="text-2xl text-muted-foreground">/100</span>
            </div>
          </motion.div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge
              className={
                result.passed
                  ? "border-transparent bg-emerald-500 text-white"
                  : "border-transparent bg-rose-500 text-white"
              }
            >
              {result.passed ? t("quiz.result.passed") : t("quiz.result.failed")}
            </Badge>
            {result.perfect && (
              <Badge className="gap-1 border-transparent bg-amber-500 text-white">
                <Sparkles className="h-3 w-3" />
                {t("quiz.result.perfect")}
              </Badge>
            )}
          </div>

          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {result.passed ? t("quiz.result.passedHint") : t("quiz.result.failedHint")}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {result.passed ? (
              <Button className="h-10" onClick={onGoMission}>
                <FlaskConical className="h-4 w-4" />
                {t("quiz.result.goMission")}
              </Button>
            ) : (
              <Button variant="outline" className="h-10" onClick={onRetry}>
                <RotateCcw className="h-4 w-4" />
                {t("quiz.result.retry")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4 sm:p-6">
          <h3 className="font-bold">{t("quiz.result.detail")}</h3>
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {result.results.map((r) => {
              const q = quiz[r.index];
              if (!q) return null;
              return (
                <div
                  key={r.index}
                  className={cn(
                    "space-y-2 rounded-xl border p-3",
                    r.isCorrect
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-rose-500/30 bg-rose-500/5",
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
                        {t("quiz.result.yourAnswer")}{" "}
                        <span
                          className={
                            r.isCorrect ? "font-semibold text-emerald-500" : "font-semibold text-rose-500"
                          }
                        >
                          {userAnswerLabel(q, answers[r.index] ?? null, t)}
                        </span>
                        {!r.isCorrect && (
                          <>
                            {" — "}
                            {t("quiz.result.correctAnswer")}{" "}
                            <span className="font-semibold text-emerald-500">{correctAnswerLabel(q, r, t)}</span>
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
  t,
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
  t: Translator;
}) {
  if (quiz.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          {t("quiz.empty")}
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
        t={t}
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
        t={t}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" className="h-10" onClick={() => setCurrent(index - 1)} disabled={index === 0}>
          <ArrowLeft className="h-4 w-4" />
          {t("quiz.previous")}
        </Button>
        {!isLast ? (
          <Button className="h-10" onClick={() => setCurrent(index + 1)} disabled={answers?.[index] == null}>
            {t("quiz.next")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button className="h-10" onClick={onSubmit} disabled={!allAnswered || submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
            {t("quiz.submit")}
          </Button>
        )}
      </div>

      {!allAnswered && (
        <p className="text-center text-xs text-muted-foreground">
          {t("quiz.allAnswered", { count: quiz.length })}
        </p>
      )}
    </div>
  );
}

/* ============ Étape 4bis : Mission BITLAB_PROOF ============ */

function BitLabProofStep({
  quest,
  missionMeta,
  submitting,
  onSubmit,
  t,
}: {
  quest: Quest;
  missionMeta: QuestDetail["missionMeta"];
  submitting: boolean;
  onSubmit: (answer: Record<string, unknown>) => void;
  t: Translator;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const withTheme = useAppendTheme();
  const kind = toBitlabKind(quest.missionType);

  const bitlabReturn = useMemo(() => {
    const result = parseBitlabReturn(searchParams);
    return result && result.kind === kind ? result : null;
  }, [searchParams, kind]);

  const [txid, setTxid] = useState(() => bitlabReturn?.value ?? "");
  const [network, setNetwork] = useState<"testnet4" | "signet" | "regtest">(() => {
    const n = bitlabReturn?.network;
    return n === "testnet4" || n === "signet" || n === "regtest" ? n : "testnet4";
  });
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!bitlabReturn) return;
    const ts = Number(searchParams.get("ts") ?? "");
    const sig = searchParams.get("sig") ?? "";
    const verify = async () => {
      if (ts && sig) {
        try {
          const res = await api.bitlabDeepLinkVerifyReturn({
            questCode: quest.code,
            kind,
            network: bitlabReturn.network,
            ts,
            sig,
          });
          if (res.enforced && !res.ok) {
            toast({
              variant: "destructive",
              title: t("bitlabProof.toast.invalid.title"),
              description: t("bitlabProof.toast.invalid.description"),
            });
            router.replace(pathname);
            return;
          }
        } catch {
          // Si l'endpoint échoue, on laisse passer (defense-in-depth optionnel)
        }
      }
      toast({
        title: t("bitlabProof.toast.received.title"),
        description: t("bitlabProof.toast.received.description"),
      });
      router.replace(pathname);
    };
    void verify();
  }, [bitlabReturn, toast, router, pathname, searchParams, quest.code, kind, t]);

  const bitlabUrl =
    process.env.NEXT_PUBLIC_BITLAB_URL ?? "https://bitlab.example/mission";

  const inputConfig: {
    field: string;
    label: string;
    placeholder: string;
    hint: string;
    validate: (s: string) => boolean;
  } = (() => {
    const base = (k: BitlabKind, field: string, validate: (s: string) => boolean) => ({
      field,
      label: t(`bitlabProof.input.${k}.label`),
      placeholder: t(`bitlabProof.input.${k}.placeholder`),
      hint: t(`bitlabProof.input.${k}.hint`),
      validate,
    });
    switch (kind) {
      case "BLOCK":
        return base("BLOCK", "hash", (s) => /^[0-9a-f]{64}$/i.test(s.trim()));
      case "INVOICE":
        return base("INVOICE", "bolt11", (s) => /^ln[a-z0-9]{10,}$/i.test(s.trim()));
      case "CHANNEL":
        return base(
          "CHANNEL",
          "scid",
          (s) => /^\d+x\d+x\d+$/.test(s.trim()) || /^\d{10,24}$/.test(s.trim()),
        );
      case "ADDRESS":
        return base("ADDRESS", "address", (s) => /^[a-zA-Z0-9]{10,100}$/.test(s.trim()));
      case "TX":
      default:
        return base("TX", "txid", (s) => /^[0-9a-f]{64}$/i.test(s.trim()));
    }
  })();

  const isValid = inputConfig.validate(txid);

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const value = txid.trim();
      const challenge = await api.bitlabChallenge({ questCode: quest.code, kind });
      await api.bitlabProof({
        questCode: quest.code,
        kind,
        network,
        payload: { [inputConfig.field]: value },
        challenge: challenge.token,
      });
    },
    onSuccess: () => {
      setLocalError(null);
      toast({
        title: t("bitlabProof.toast.verified.title"),
        description: t("bitlabProof.toast.verified.description"),
      });
      onSubmit({});
    },
    onError: (err) => {
      setLocalError(errorMessage(err, t));
    },
  });

  const openDeepLinkMutation = useMutation({
    mutationFn: async () => {
      const returnTo =
        typeof window !== "undefined"
          ? `${window.location.origin}${pathname}`
          : pathname;
      return api.bitlabDeepLink({ questCode: quest.code, kind, network, returnTo });
    },
    onSuccess: (res) => {
      window.location.href = withTheme(res.url);
    },
    onError: (err) => {
      setLocalError(errorMessage(err, t));
    },
  });

  const canSubmit = isValid && !verifyMutation.isPending && !submitting;

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FlaskConical className="h-5 w-5" />
          </span>
          <div>
            <div className="font-bold">{t("bitlabProof.title")}</div>
            <div className="text-xs text-muted-foreground">
              {t("bitlabProof.subtitle", { kind, network })}
            </div>
          </div>
        </div>

        {missionMeta.brief && (
          <p className="text-sm leading-relaxed text-muted-foreground">{missionMeta.brief}</p>
        )}

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>{t("bitlabProof.mode.title")}</AlertTitle>
          <AlertDescription>
            {t("bitlabProof.mode.description", { label: inputConfig.label.toLowerCase() })}
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2"
            disabled={openDeepLinkMutation.isPending}
            onClick={() => openDeepLinkMutation.mutate()}
          >
            {openDeepLinkMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            {t("bitlabProof.open")}
          </Button>
          <span className="text-xs text-muted-foreground">{t("bitlabProof.returnHint")}</span>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bq-bitlab-payload">{inputConfig.label}</Label>
          <Input
            id="bq-bitlab-payload"
            className="font-mono"
            placeholder={inputConfig.placeholder}
            value={txid}
            onChange={(e) => {
              setTxid(e.target.value);
              setLocalError(null);
            }}
            disabled={verifyMutation.isPending || submitting}
          />
          {txid.length > 0 && !isValid && (
            <p className="text-xs text-destructive">{inputConfig.hint}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bq-bitlab-network">{t("bitlabProof.network")}</Label>
          <select
            id="bq-bitlab-network"
            value={network}
            onChange={(e) => setNetwork(e.target.value as typeof network)}
            disabled={verifyMutation.isPending || submitting}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="testnet4">testnet4</option>
            <option value="signet">signet</option>
            <option value="regtest">regtest</option>
          </select>
        </div>

        {localError && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>{t("bitlabProof.rejected.title")}</AlertTitle>
            <AlertDescription>{localError}</AlertDescription>
          </Alert>
        )}

        <div>
          <Button
            type="button"
            className="h-10"
            disabled={!canSubmit}
            onClick={() => verifyMutation.mutate()}
          >
            {verifyMutation.isPending || submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FlaskConical className="h-4 w-4" />
            )}
            {verifyMutation.isPending
              ? t("bitlabProof.verifying")
              : submitting
                ? t("bitlabProof.finalizing")
                : t("bitlabProof.verify")}
          </Button>
        </div>

        {missionMeta.hint && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">{t("bitlabProof.hint.label")} </span>
            {missionMeta.hint}
          </p>
        )}
      </CardContent>
    </Card>
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
  t,
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
  t: Translator;
}) {
  const alreadyCompleted = progress?.status === "COMPLETED" && progress?.missionProof != null;

  if (alreadyCompleted) {
    return (
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex items-center gap-2 text-emerald-500">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-bold">{t("mission.alreadyCompleted.title")}</span>
          </div>
          <p className="text-sm text-muted-foreground">{t("mission.alreadyCompleted.body")}</p>
          <ProofChips proof={progress?.missionProof ?? null} />
          <p className="text-xs text-muted-foreground">{t("mission.alreadyCompleted.serverNote")}</p>
          <RewardChips xp={quest.xpReward} sats={quest.satsReward} />
          <div>
            <Button className="h-10" onClick={onFinish}>
              {t("mission.finish")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (quest.missionKind === "BITLAB_PROOF") {
    return (
      <BitLabProofStep
        quest={quest}
        missionMeta={missionMeta}
        submitting={submitting}
        onSubmit={onSubmit}
        t={t}
      />
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
            <div className="font-bold">{t("mission.bitlab.title")}</div>
            <div className="text-xs text-muted-foreground">{t("mission.bitlab.subtitle")}</div>
          </div>
        </div>

        {missionMeta.brief && (
          <p className="text-sm leading-relaxed text-muted-foreground">{missionMeta.brief}</p>
        )}

        <div>
          <Button className="h-10" onClick={onLaunch} disabled={starting}>
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            {t("mission.bitlab.launch")}
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">{t("mission.bitlab.serverNote")}</p>
      </CardContent>
    </Card>
  );
}

/* ============ Étape 5 : Récompenses ============ */

function RewardsStep({
  questCode,
  questTitle,
  rewards,
  onBackToMap,
  onDashboard,
  t,
}: {
  questCode: string;
  questTitle: string;
  rewards: MissionSubmitResponse;
  onBackToMap: () => void;
  onDashboard: () => void;
  t: Translator;
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
    [],
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
          <h2 className="mt-3 font-display text-2xl font-black tracking-tight sm:text-3xl">
            {t("rewards.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("rewards.subtitle", { title: questTitle })}
          </p>
        </div>
      </motion.div>

      {rewards.feedback && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <AlertTitle>{t("rewards.feedback.title")}</AlertTitle>
          <AlertDescription>{rewards.feedback}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <RewardChips xp={rewards.xp?.xpGained} />
            {rewards.bonusXp?.xpGained ? (
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                {t("rewards.bonusXp", { xp: rewards.bonusXp.xpGained })}
              </Badge>
            ) : null}
          </div>

          {sats && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Coins className="h-4 w-4 shrink-0 text-amber-500" />
                <span>
                  {t("rewards.sats.receive")}{" "}
                  <span className="font-bold text-amber-500">{formatSats(sats.granted)} sats</span>
                  {sats.streakBonus > 0 && (
                    <span className="text-muted-foreground">
                      {t("rewards.sats.streakBonus", {
                        bonus: formatSats(sats.streakBonus),
                        pct: sats.streakBonusPct,
                      })}
                    </span>
                  )}
                </span>
              </div>
              {sats.capped && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>{t("rewards.sats.cap.title")}</AlertTitle>
                  <AlertDescription>{t("rewards.sats.cap.description")}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {rewards.proof && (
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">{t("rewards.proofLabel")}</div>
              <ProofChips proof={rewards.proof} />
            </div>
          )}

          {rewards.badges && rewards.badges.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-bold">{t("rewards.badges.title")}</div>
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
                          {t(`rarity.${b.rarity}`)}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {sats && sats.granted > 0 && (
            <a
              href={`/rewards?from=${encodeURIComponent(questCode)}`}
              className="flex items-center justify-between rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm transition-colors hover:border-amber-500/60 hover:bg-amber-500/10"
            >
              <span className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" aria-hidden />
                <span className="font-medium">{t("rewards.lightning.cta.label")}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {t("rewards.lightning.cta.hint")}
              </span>
            </a>
          )}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <Button variant="outline" className="h-10 flex-1" onClick={onBackToMap}>
              {t("rewards.backToMap")}
            </Button>
            <Button className="h-10 flex-1" onClick={onDashboard}>
              <Trophy className="h-4 w-4" />
              {t("rewards.dashboard")}
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
  onGoToDashboard,
}: {
  code: string;
  onExit: () => void;
  onCompleted: () => void;
  onGoToDashboard?: () => void;
}) {
  const { toast } = useToast();
  const t = useT();
  const invalidateAll = useInvalidateAll();
  const { data: detail, isLoading, isError, refetch } = useQuestDetail(code);

  const [step, setStep] = useState<Step>("intro");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [sectionsRead, setSectionsRead] = useState(0);
  const [quizBest, setQuizBest] = useState(0);
  const [answers, setAnswers] = useState<(number | boolean | null)[] | null>(null);
  const [quizQuestion, setQuizQuestion] = useState(0);
  const [quizResult, setQuizResult] = useState<QuizSubmitResponse | null>(null);
  // Flag pour ne reprendre le state local (sessionStorage) qu'une seule fois
  // par mount de quête. Évite d'écraser l'input utilisateur pendant la session.
  // On stocke le code hydraté plutôt qu'un bool : la navigation entre quêtes
  // re-déclenche naturellement l'hydratation sans useEffect reset dédié.
  const [localHydratedCode, setLocalHydratedCode] = useState<string | null>(null);
  const localHydrated = localHydratedCode === code;
  const [challenge, setChallenge] = useState<Record<string, unknown> | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(0);
  const [lastFeedback, setLastFeedback] = useState<{ success: boolean; feedback: string } | null>(null);
  const [rewards, setRewards] = useState<MissionSubmitResponse | null>(null);

  const startedRef = useRef(false);
  const [hydratedCode, setHydratedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!code || startedRef.current) return;
    startedRef.current = true;
    api.startQuest(code).catch(() => {});
  }, [code]);

  const quest = detail?.quest ?? null;
  const quiz = detail?.quiz ?? [];
  const progress = detail?.progress ?? null;

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

  if (answers === null && quiz.length > 0) {
    setAnswers(Array(quiz.length).fill(null));
  }

  // Hydratation sessionStorage : reprend step/sectionIndex/quizQuestion/answers
  // là où l'utilisateur en était avant un refresh ou un changement de page.
  // Clé scope par questCode uniquement — sessionStorage est déjà scope par onglet
  // (donc par navigateur + session + onglet, ce qui matche implicitement l'user).
  // On ne reprend qu'une fois : les écritures ultérieures en session rôdent les
  // données utilisateur sans jamais être écrasées par cette logique.
  //
  // Les setState() dans cet effet sont des hydratations initiales (one-shot
  // gated by `localHydrated`) — pattern légitime pour synchroniser un state
  // React avec un storage externe au premier render.
  useEffect(() => {
    if (localHydrated || hydratedCode !== code || !detail) return;
    try {
      const raw = typeof window !== "undefined"
        ? window.sessionStorage.getItem(`bq.quest.${code}`)
        : null;
      if (raw) {
        const saved = JSON.parse(raw) as {
          step?: Step;
          sectionIndex?: number;
          quizQuestion?: number;
          answers?: (number | boolean | null)[];
        };
        // Garde-fou : taille answers doit matcher le quiz courant, sinon stale.
        if (saved.answers && saved.answers.length === quiz.length) {
          setAnswers(saved.answers);
        }
        if (typeof saved.quizQuestion === "number") {
          setQuizQuestion(Math.max(0, Math.min(saved.quizQuestion, quiz.length - 1)));
        }
        if (typeof saved.sectionIndex === "number") {
          setSectionIndex(
            Math.max(0, Math.min(saved.sectionIndex, detail.quest.theorySections.length - 1)),
          );
        }
        if (
          saved.step === "intro" ||
          saved.step === "theory" ||
          saved.step === "quiz" ||
          saved.step === "mission" ||
          saved.step === "rewards"
        ) {
          setStep(saved.step);
        }
      } else if (detail.progress) {
        // Pas de sauvegarde locale : reprends au bon endroit depuis le serveur.
        const p = detail.progress;
        const theoryTotal = detail.quest.theorySections.length;
        const theoryDoneServer = p.sectionsRead >= theoryTotal;
        const quizPassedServer = p.quizBestScore >= QUIZ_PASS_THRESHOLD;
        if (p.status === "COMPLETED") {
          setStep("rewards");
        } else if (quizPassedServer) {
          setStep("mission");
        } else if (theoryDoneServer) {
          setStep("quiz");
        } else if (p.sectionsRead > 0) {
          setStep("theory");
        }
      }
    } catch {
      // sessionStorage inaccessible (SSR / mode privé / corruption) : no-op silencieux.
    }
    setLocalHydratedCode(code);
  }, [localHydrated, hydratedCode, code, detail, quiz.length]);

  // Persistance : écrit l'état courant dans sessionStorage à chaque changement
  // significatif. Débouncé implicitement par React batching ; la sérialisation
  // JSON + setItem est bon marché pour ces volumes.
  useEffect(() => {
    if (!localHydrated || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        `bq.quest.${code}`,
        JSON.stringify({ step, sectionIndex, quizQuestion, answers }),
      );
    } catch {
      // quota exceeded / disabled : on ignore, l'app continue à fonctionner en RAM.
    }
  }, [localHydrated, code, step, sectionIndex, quizQuestion, answers]);

  const theoryDone = quest ? sectionsRead >= quest.theorySections.length : false;
  const quizPassed = quizBest >= QUIZ_PASS_THRESHOLD;
  const completed = progress?.status === "COMPLETED" || rewards !== null;

  /* ---------- Mutations ---------- */

  const readSectionMutation = useMutation({
    mutationFn: (index: number) => api.readSection(code, index),
    onSuccess: (res, index) => {
      setSectionsRead((prev) => Math.max(prev, index + 1));
      if (res.xp) {
        toast({
          title: `+${res.xp.xpGained} XP`,
          description: t("player.toast.section.description"),
        });
      }
      const total = quest?.theorySections.length ?? 0;
      if (index + 1 >= total) {
        setStep("quiz");
      } else {
        setSectionIndex(index + 1);
      }
    },
    onError: (err) =>
      toast({ variant: "destructive", title: t("player.toast.error.title"), description: errorMessage(err, t) }),
  });

  const quizSubmitMutation = useMutation({
    mutationFn: (payload: (number | boolean)[]) => api.quizSubmit(code, payload),
    onSuccess: (res) => {
      setQuizResult(res);
      setQuizBest((prev) => Math.max(prev, res.score));
      if (res.xp) {
        toast({ title: `+${res.xp.xpGained} XP`, description: t("player.toast.quiz.description") });
      }
      notifyBadges(toast, t, res.badges);
      invalidateAll();
    },
    onError: (err) =>
      toast({ variant: "destructive", title: t("player.toast.error.title"), description: errorMessage(err, t) }),
  });

  const missionStartMutation = useMutation({
    mutationFn: () => api.missionStart(code),
    onSuccess: (res) => {
      setChallenge(res.challenge);
      setAttemptsLeft(res.attemptsLeft);
      setLastFeedback(null);
    },
    onError: (err) =>
      toast({ variant: "destructive", title: t("player.toast.error.title"), description: errorMessage(err, t) }),
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
          toast({
            title: `+${res.xp.xpGained} XP`,
            description: t("player.toast.mission.description"),
          });
        }
        if (res.bonusXp?.xpGained) {
          toast({
            title: `+${res.bonusXp.xpGained} XP`,
            description: t("player.toast.mission.bonus"),
          });
        }
        if (res.sats && res.sats.granted > 0) {
          toast({
            title: `+${formatSats(res.sats.granted)} sats`,
            description: res.sats.capped
              ? t("player.toast.sats.capped")
              : t("player.toast.sats.credited"),
          });
        }
        notifyBadges(toast, t, res.badges);
      } else {
        setLastFeedback({ success: false, feedback: res.feedback });
        if (typeof res.attemptsLeft === "number") {
          setAttemptsLeft(res.attemptsLeft);
        } else {
          setAttemptsLeft((prev) => Math.max(0, prev - 1));
        }
      }
    },
    onError: (err) =>
      toast({ variant: "destructive", title: t("player.toast.error.title"), description: errorMessage(err, t) }),
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
    return <LoadingState label={t("player.loading")} />;
  }

  if (isError) {
    return <ErrorState message={t("player.error")} onRetry={() => refetch()} />;
  }

  if (!quest) {
    return (
      <EmptyState
        title={t("player.notFound.title")}
        sub={t("player.notFound.sub")}
        icon={Map}
      />
    );
  }

  const ts = getTrackStyle(quest.track);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <Button variant="ghost" className="h-10 gap-2" onClick={onExit}>
          <ArrowLeft className="h-4 w-4" />
          {t("player.back")}
        </Button>
      </div>

      <header className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">{quest.title}</h1>
          <Badge variant="outline" className={cn("gap-1.5", ts.badge)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", ts.dot)} />
            {t(`tracks.${quest.track}`)}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm text-muted-foreground">{quest.subtitle}</span>
          <RewardChips xp={quest.xpReward} sats={quest.satsReward} />
        </div>
      </header>

      <ol className="flex items-center overflow-x-auto pb-1" aria-label={t("player.stepper.aria")}>
        {STEP_KEYS.map((s, i) => {
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
                      : "cursor-not-allowed text-muted-foreground/50",
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
                          : "border-border/60 text-muted-foreground/60",
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
                <span className="whitespace-nowrap">{t(s.labelKey)}</span>
              </button>
              {i < STEP_KEYS.length - 1 && (
                <span className="mx-1 h-px w-5 shrink-0 bg-border sm:w-8" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {step === "intro" && <IntroStep quest={quest} onStart={() => setStep("theory")} t={t} />}

          {step === "theory" && (
            <TheoryStep
              quest={quest}
              sectionIndex={sectionIndex}
              reading={readSectionMutation.isPending}
              onRead={() => readSectionMutation.mutate(sectionIndex)}
              onBack={() => setSectionIndex((i) => Math.max(0, i - 1))}
              t={t}
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
              t={t}
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
              t={t}
            />
          )}

          {step === "rewards" && rewards && (
            <RewardsStep
              questCode={code}
              questTitle={quest.title}
              rewards={rewards}
              onBackToMap={onCompleted}
              onDashboard={onGoToDashboard ?? onCompleted}
              t={t}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
