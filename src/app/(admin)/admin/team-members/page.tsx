import { ContentLink as Link } from "@/components/admin/content-link";
import { CheckCircle2, Plus, Users } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminOrDenied } from "../_require-admin";

export const dynamic = "force-dynamic";

export default async function AdminTeamMembersPage() {
  const gate = await requireAdminOrDenied();
  if (!gate.ok) return gate.element;

  const members = await db.teamMember.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Équipe GandalNexus
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {members.length} membre{members.length > 1 ? "s" : ""} configuré
            {members.length > 1 ? "s" : ""} · visibles sur la landing publique
            <code className="ml-1 rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
              /gandalnexus
            </code>
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/team-members/new">
            <Plus className="h-4 w-4" aria-hidden />
            Nouveau membre
          </Link>
        </Button>
      </header>

      {members.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <Users className="h-8 w-8 opacity-40" aria-hidden />
            <p className="text-sm">Aucun membre pour l&apos;instant.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/team-members/new">Ajouter le premier membre</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {members.map((m) => {
            const published = m.publishedAt !== null;
            return (
              <li key={m.id}>
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          aria-hidden
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display font-bold text-primary"
                        >
                          {m.initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="truncate text-base">{m.name}</CardTitle>
                          <CardDescription className="truncate">{m.role}</CardDescription>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          published
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                            : "border-amber-500/40 bg-amber-500/10 text-amber-500"
                        }
                      >
                        {published ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" aria-hidden /> Publié
                          </>
                        ) : (
                          "Brouillon"
                        )}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {m.contribution}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Ordre : {m.order}
                      </span>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/team-members/${m.id}`}>Éditer</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
