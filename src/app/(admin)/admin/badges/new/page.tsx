import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BadgeForm } from "../badge-form";
import { requireAdminOrDenied } from "../../_require-admin";

export const metadata = { title: "Nouveau badge — Admin BitQuest" };

export default async function NewBadgePage() {
  const gate = await requireAdminOrDenied();
  if (!gate.ok) return gate.element;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/badges">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour à la liste
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Nouveau badge</CardTitle>
          <CardDescription>
            Les badges sont attribués automatiquement par <code>evaluateBadges()</code> à chaque
            action utilisateur. Le code doit rester stable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BadgeForm
            mode="create"
            initial={{
              code: "",
              name: "",
              description: "",
              icon: "Trophy",
              rarity: "COMMON",
              conditionType: "QUEST_COMPLETE",
              conditionValue: {},
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
