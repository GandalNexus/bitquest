import { ArrowLeft } from "lucide-react";
import { ContentLink as Link } from "@/components/admin/content-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewQuestForm } from "./new-quest-form";

export const metadata = { title: "Nouvelle quête — Admin BitQuest" };

export default function NewQuestPage() {
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/quests">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour à la liste
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle quête</CardTitle>
          <CardDescription>
            Crée la coquille d&apos;une quête (code, piste, récompenses, type de
            mission). La théorie, le quiz et la configuration mission se
            remplissent ensuite via les builders dédiés.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewQuestForm />
        </CardContent>
      </Card>
    </div>
  );
}
