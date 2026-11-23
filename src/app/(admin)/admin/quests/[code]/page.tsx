import { ContentLink as Link } from "@/components/admin/content-link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QuestForm } from "../quest-form";

export const dynamic = "force-dynamic";

const TRACKS = ["INITIATION", "INTERMEDIATE", "ADVANCED", "SPECIAL"] as const;
type Track = (typeof TRACKS)[number];

function isTrack(value: string): value is Track {
  return (TRACKS as readonly string[]).includes(value);
}

export default async function EditQuestPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const quest = await db.quest.findUnique({
    where: { code },
    include: {
      _count: { select: { progress: true, quizQuestions: true } },
    },
  });
  if (!quest) notFound();

  const theorySections = parseJsonArray(quest.theorySections);
  const missionConfig = parseJsonObject(quest.missionConfig);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/quests">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour aux quêtes
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Éditer : {quest.title}</CardTitle>
          <CardDescription>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden />
              {quest._count.progress} progression{quest._count.progress > 1 ? "s" : ""} ·{" "}
              {quest._count.quizQuestions} question{quest._count.quizQuestions > 1 ? "s" : ""} de
              quiz
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuestForm
            initial={{
              code: quest.code,
              track: isTrack(quest.track) ? quest.track : "INITIATION",
              order: quest.order,
              title: quest.title,
              subtitle: quest.subtitle,
              description: quest.description,
              intro: quest.intro,
              xpReward: quest.xpReward,
              satsReward: quest.satsReward,
              requiredLevel: quest.requiredLevel,
            }}
          />
        </CardContent>
      </Card>

      {/* Sections théoriques — éditables */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-sm">
              Sections théoriques ({theorySections.length})
            </CardTitle>
            <CardDescription>
              Contenu enseigné pendant la phase « Théorie » de la quête.
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/quests/${quest.code}/theory`}>Éditer</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
            {theorySections.length === 0 ? (
              <li>Aucune section.</li>
            ) : (
              theorySections.map((s, i) => (
                <li key={i}>{typeof s.title === "string" ? s.title : `Section ${i + 1}`}</li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>

      {/* Quiz — éditable */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-sm">
              Quiz ({quest._count.quizQuestions} question{quest._count.quizQuestions > 1 ? "s" : ""})
            </CardTitle>
            <CardDescription>
              Questions MCQ et Vrai/Faux proposées après la phase « Théorie ».
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/quests/${quest.code}/quiz`}>Éditer</Link>
          </Button>
        </CardHeader>
      </Card>

      {/* Mission — éditable */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-sm">
              Mission : <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{quest.missionType}</code>
            </CardTitle>
            <CardDescription>
              Type + brief/hint + config JSON type-spécifique.
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/quests/${quest.code}/mission`}>Éditer</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="max-h-40 overflow-auto rounded-md border bg-muted/40 p-2 text-[10px] text-muted-foreground">
            {JSON.stringify(missionConfig, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---- Helpers ---- */

function parseJsonArray(raw: string): { title?: unknown }[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
