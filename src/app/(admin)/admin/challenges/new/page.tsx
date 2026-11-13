import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { todayUtc } from "@/lib/bitquest/challenges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChallengeForm } from "../challenge-form";
import { requireAdminOrDenied } from "../../_require-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nouveau défi — Admin BitQuest" };

export default async function NewChallengePage() {
  const gate = await requireAdminOrDenied();
  if (!gate.ok) return gate.element;

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
          <CardTitle>Nouveau défi</CardTitle>
          <CardDescription>
            Un défi par date UTC. Les récompenses sont plafonnées à 500 (XP et sats) pour
            rester cohérentes avec le plafond quotidien global de 10 000 sats.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChallengeForm
            mode="create"
            initial={{
              date: todayUtc(),
              title: "",
              prompt: "",
              xpReward: 10,
              satsReward: 50,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
