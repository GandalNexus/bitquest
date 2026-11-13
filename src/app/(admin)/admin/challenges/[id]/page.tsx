import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChallengeForm } from "../challenge-form";
import { requireAdminOrDenied } from "../../_require-admin";

export const dynamic = "force-dynamic";

export default async function EditChallengePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const gate = await requireAdminOrDenied();
  if (!gate.ok) return gate.element;

  const { id } = await params;
  const challenge = await db.dailyChallenge.findUnique({
    where: { id },
    include: { _count: { select: { completions: true } } },
  });
  if (!challenge) notFound();

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/challenges">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour à la liste
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Éditer : {challenge.title}</CardTitle>
          <CardDescription>
            {challenge._count.completions} validation
            {challenge._count.completions > 1 ? "s" : ""} déjà enregistrée
            {challenge._count.completions > 1 ? "s" : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChallengeForm
            mode="edit"
            completionsCount={challenge._count.completions}
            initial={{
              id: challenge.id,
              date: challenge.date,
              title: challenge.title,
              prompt: challenge.prompt,
              xpReward: challenge.xpReward,
              satsReward: challenge.satsReward,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
