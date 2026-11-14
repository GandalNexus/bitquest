import { notFound } from "next/navigation";
import { ContentLink as Link } from "@/components/admin/content-link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminOrDenied } from "../../_require-admin";
import { TeamMemberForm } from "../team-member-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Éditer un membre — Équipe GandalNexus" };

export default async function EditTeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const gate = await requireAdminOrDenied();
  if (!gate.ok) return gate.element;

  const { id } = await params;
  const member = await db.teamMember.findUnique({ where: { id } });
  if (!member) notFound();

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
          <CardTitle>Éditer : {member.name}</CardTitle>
          <CardDescription>Modifier les informations du membre.</CardDescription>
        </CardHeader>
        <CardContent>
          <TeamMemberForm
            mode="edit"
            initial={{
              id: member.id,
              name: member.name,
              role: member.role,
              contribution: member.contribution,
              initials: member.initials,
              avatarUrl: member.avatarUrl ?? "",
              order: member.order,
              publishedAt: member.publishedAt ? member.publishedAt.toISOString() : null,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
