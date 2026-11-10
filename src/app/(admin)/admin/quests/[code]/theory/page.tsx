import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TheoryEditor } from "./theory-editor";

export const dynamic = "force-dynamic";

interface RawSection {
  title?: unknown;
  body?: unknown;
  keypoints?: unknown;
}

function parseSections(raw: string): { title: string; body: string; keypoints: string[] }[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as RawSection[]).map((s) => ({
      title: typeof s?.title === "string" ? s.title : "",
      body: typeof s?.body === "string" ? s.body : "",
      keypoints: Array.isArray(s?.keypoints)
        ? (s.keypoints as unknown[]).filter((k): k is string => typeof k === "string")
        : [],
    }));
  } catch {
    return [];
  }
}

export default async function EditQuestTheoryPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const quest = await db.quest.findUnique({ where: { code } });
  if (!quest) notFound();

  const sections = parseSections(quest.theorySections);

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
            <BookOpen className="h-5 w-5 text-primary" aria-hidden />
            Sections théoriques — {quest.title}
          </CardTitle>
          <CardDescription>
            Contenu lu par les apprenants pendant la phase « Théorie ». Le save remplace
            l&apos;intégralité du tableau pour cette quête.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TheoryEditor code={quest.code} initial={sections} />
        </CardContent>
      </Card>
    </div>
  );
}
