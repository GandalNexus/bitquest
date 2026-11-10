"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Circle,
  ListChecks,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { readCookie } from "@/lib/bitquest/client";

/* ============ Types éditeur ============ */

type QuestionState =
  | {
      type: "MCQ";
      question: string;
      options: string[];
      correctIndex: number;
      explanation: string;
    }
  | {
      type: "TRUE_FALSE";
      question: string;
      correctBool: boolean;
      explanation: string;
    };

const EMPTY_MCQ: QuestionState = {
  type: "MCQ",
  question: "",
  options: ["", ""],
  correctIndex: 0,
  explanation: "",
};
const EMPTY_TF: QuestionState = {
  type: "TRUE_FALSE",
  question: "",
  correctBool: true,
  explanation: "",
};

/* ============ Éditeur ============ */

export function QuizEditor({
  code,
  initial,
}: {
  code: string;
  initial: QuestionState[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [questions, setQuestions] = useState<QuestionState[]>(
    initial.length > 0 ? initial : [{ ...EMPTY_MCQ }],
  );

  const mutate = (idx: number, mapper: (q: QuestionState) => QuestionState) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? mapper(q) : q)));
    setSaved(false);
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, { ...EMPTY_MCQ }]);
    setSaved(false);
  };
  const removeQuestion = (idx: number) => {
    if (questions.length === 1) {
      setError("Impossible de retirer la dernière question (minimum 1).");
      return;
    }
    if (!confirm(`Supprimer la question ${idx + 1} ?`)) return;
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
    setSaved(false);
  };
  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= questions.length) return;
    setQuestions((prev) => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setSaved(false);
  };
  const toggleType = (idx: number) => {
    mutate(idx, (q) =>
      q.type === "MCQ"
        ? { type: "TRUE_FALSE", question: q.question, explanation: q.explanation, correctBool: true }
        : { ...EMPTY_MCQ, question: q.question, explanation: q.explanation },
    );
  };

  const onSave = async () => {
    setError(null);
    setSaved(false);
    // Nettoyage client : retire les options vides pour MCQ et borne correctIndex
    const cleaned: QuestionState[] = questions.map((q) => {
      if (q.type === "MCQ") {
        const opts = q.options.map((o) => o.trim()).filter((o) => o.length > 0);
        return {
          ...q,
          options: opts,
          correctIndex: Math.min(q.correctIndex, Math.max(0, opts.length - 1)),
        };
      }
      return q;
    });
    const csrf = readCookie("bq_csrf");
    try {
      const res = await fetch(`/api/admin/quests/${code}/quiz`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({ questions: cleaned }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      setSaved(true);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {questions.length} question{questions.length > 1 ? "s" : ""} — chaque question est
          typée MCQ (2-6 options) ou Vrai/Faux.
        </p>
        <button
          type="button"
          onClick={addQuestion}
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-sm text-primary hover:bg-primary/20"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Ajouter une question
        </button>
      </div>

      <ol className="space-y-6" aria-label="Questions du quiz">
        {questions.map((q, idx) => (
          <li key={idx} className="rounded-xl border bg-background/60 p-4">
            <header className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Question {idx + 1} / {questions.length}
                </h3>
                <button
                  type="button"
                  onClick={() => toggleType(idx)}
                  className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                  title="Basculer MCQ ↔ Vrai/Faux"
                >
                  {q.type === "MCQ" ? (
                    <>
                      <ListChecks className="h-3 w-3" aria-hidden />
                      MCQ
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="h-3 w-3" aria-hidden />
                      Vrai/Faux
                    </>
                  )}
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  aria-label="Monter la question"
                  className="rounded-md border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
                >
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === questions.length - 1}
                  aria-label="Descendre la question"
                  className="rounded-md border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => removeQuestion(idx)}
                  aria-label="Supprimer la question"
                  className="rounded-md border border-destructive/40 p-1.5 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </header>

            <label className="block text-sm">
              <span className="block font-medium">Énoncé</span>
              <textarea
                rows={2}
                value={q.question}
                onChange={(e) => mutate(idx, (p) => ({ ...p, question: e.target.value }))}
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              />
            </label>

            {q.type === "MCQ" ? (
              <McqOptions
                options={q.options}
                correctIndex={q.correctIndex}
                onChangeOption={(j, value) =>
                  mutate(idx, (p) =>
                    p.type === "MCQ"
                      ? { ...p, options: p.options.map((o, k) => (k === j ? value : o)) }
                      : p,
                  )
                }
                onAddOption={() =>
                  mutate(idx, (p) =>
                    p.type === "MCQ" && p.options.length < 6
                      ? { ...p, options: [...p.options, ""] }
                      : p,
                  )
                }
                onRemoveOption={(j) =>
                  mutate(idx, (p) => {
                    if (p.type !== "MCQ" || p.options.length <= 2) return p;
                    const next = p.options.filter((_, k) => k !== j);
                    const correctIndex = Math.min(p.correctIndex, next.length - 1);
                    return { ...p, options: next, correctIndex };
                  })
                }
                onSelectCorrect={(j) =>
                  mutate(idx, (p) => (p.type === "MCQ" ? { ...p, correctIndex: j } : p))
                }
              />
            ) : (
              <TrueFalseAnswer
                value={q.correctBool}
                onChange={(bool) =>
                  mutate(idx, (p) => (p.type === "TRUE_FALSE" ? { ...p, correctBool: bool } : p))
                }
              />
            )}

            <label className="mt-3 block text-sm">
              <span className="block font-medium">Explication (révélée après la réponse)</span>
              <textarea
                rows={2}
                value={q.explanation}
                onChange={(e) => mutate(idx, (p) => ({ ...p, explanation: e.target.value }))}
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              />
            </label>
          </li>
        ))}
      </ol>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {saved && !error && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
          Quiz enregistré.
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          Enregistrer tout le quiz
        </button>
      </div>
    </div>
  );
}

/* ============ Sous-composants ============ */

function McqOptions({
  options,
  correctIndex,
  onChangeOption,
  onAddOption,
  onRemoveOption,
  onSelectCorrect,
}: {
  options: string[];
  correctIndex: number;
  onChangeOption: (idx: number, value: string) => void;
  onAddOption: () => void;
  onRemoveOption: (idx: number) => void;
  onSelectCorrect: (idx: number) => void;
}) {
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium">Options ({options.length})</span>
        <button
          type="button"
          onClick={onAddOption}
          disabled={options.length >= 6}
          className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted disabled:opacity-40"
        >
          + option
        </button>
      </div>
      <ul className="space-y-1">
        {options.map((opt, j) => {
          const isCorrect = j === correctIndex;
          return (
            <li key={j} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectCorrect(j)}
                aria-label={`Marquer l'option ${j + 1} comme correcte`}
                className={
                  isCorrect
                    ? "rounded-md border border-emerald-500/40 bg-emerald-500/10 p-1.5 text-emerald-500"
                    : "rounded-md border p-1.5 text-muted-foreground hover:bg-muted"
                }
              >
                {isCorrect ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                ) : (
                  <Circle className="h-4 w-4" aria-hidden />
                )}
              </button>
              <input
                type="text"
                value={opt}
                onChange={(e) => onChangeOption(j, e.target.value)}
                placeholder={`Option ${j + 1}`}
                className="w-full rounded-md border bg-background px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => onRemoveOption(j)}
                disabled={options.length <= 2}
                aria-label="Supprimer cette option"
                className="rounded-md border border-destructive/40 p-1 text-destructive hover:bg-destructive/10 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TrueFalseAnswer({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (bool: boolean) => void;
}) {
  return (
    <div className="mt-3">
      <span className="block text-sm font-medium">Bonne réponse</span>
      <div className="mt-1 inline-flex overflow-hidden rounded-md border">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={
            value
              ? "inline-flex items-center gap-1.5 bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-500"
              : "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          }
        >
          <ToggleRight className="h-4 w-4" aria-hidden />
          Vrai
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={
            !value
              ? "inline-flex items-center gap-1.5 border-l bg-rose-500/15 px-3 py-1.5 text-sm text-rose-500"
              : "inline-flex items-center gap-1.5 border-l px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          }
        >
          <ToggleLeft className="h-4 w-4" aria-hidden />
          Faux
        </button>
      </div>
    </div>
  );
}
