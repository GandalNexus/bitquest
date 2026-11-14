import { ContentLink as Link } from "@/components/admin/content-link";
import { notFound } from "next/navigation";
import { ArrowLeft, ListChecks } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QuizEditor } from "./quiz-editor";

export const dynamic = "force-dynamic";

/* ============ Hydratation depuis le format DB ============ */

type EditorQuestion =
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

function hydrate(row: {
  type: string;
  question: string;
  options: string;
  correct: string;
  explanation: string;
}): EditorQuestion | null {
  let options: unknown;
  let correct: unknown;
  try {
    options = JSON.parse(row.options);
    correct = JSON.parse(row.correct);
  } catch {
    return null;
  }

  if (row.type === "MCQ" && Array.isArray(options)) {
    const strOptions = (options as unknown[]).filter((o): o is string => typeof o === "string");
    const idxRaw = (correct as { index?: unknown })?.index;
    const correctIndex = typeof idxRaw === "number" && idxRaw >= 0 ? idxRaw : 0;
    return {
      type: "MCQ",
      question: row.question,
      options: strOptions.length > 0 ? strOptions : ["", ""],
      correctIndex: Math.min(correctIndex, Math.max(0, strOptions.length - 1)),
      explanation: row.explanation,
    };
  }
  if (row.type === "TRUE_FALSE") {
    const boolRaw = (correct as { bool?: unknown })?.bool;
    return {
      type: "TRUE_FALSE",
      question: row.question,
      correctBool: typeof boolRaw === "boolean" ? boolRaw : true,
      explanation: row.explanation,
    };
  }
  return null;
}

/* ============ Page ============ */

export default async function EditQuestQuizPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const quest = await db.quest.findUnique({
    where: { code },
    include: { quizQuestions: { orderBy: { order: "asc" } } },
  });
  if (!quest) notFound();

  const questions = quest.quizQuestions
    .map(hydrate)
    .filter((q): q is EditorQuestion => q !== null);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/admin/quests/${code}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour à la fiche quête
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" aria-hidden />
            Quiz — {quest.title}
          </CardTitle>
          <CardDescription>
            Builder des questions MCQ (2-6 options) et Vrai/Faux. Le save remplace l&apos;intégralité
            du quiz pour cette quête dans une transaction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuizEditor code={quest.code} initial={questions} />
        </CardContent>
      </Card>
    </div>
  );
}
