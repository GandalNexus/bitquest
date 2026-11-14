import { ContentLink as Link } from "@/components/admin/content-link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminOrDenied } from "../../_require-admin";
import { TeamMemberForm } from "../team-member-form";

export const metadata = { title: "Nouveau membre — Équipe GandalNexus" };

export default async function NewTeamMemberPage() {
  const gate = await requireAdminOrDenied();
  if (!gate.ok) return gate.element;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/team-members">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour à l&apos;équipe
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Nouveau membre</CardTitle>
          <CardDescription>
            Ajouter un membre à la landing publique <code>/gandalnexus</code>. Mets
            en brouillon pour préparer sans l&apos;afficher immédiatement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamMemberForm
            mode="create"
            initial={{
              name: "",
              role: "",
              contribution: "",
              initials: "",
              avatarUrl: "",
              order: 0,
              publishedAt: null,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
