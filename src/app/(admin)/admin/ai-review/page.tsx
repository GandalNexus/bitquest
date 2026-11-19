import { ContentLink as Link } from "@/components/admin/content-link";
import { Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AIReviewPanel } from "./ai-review-panel";

export const dynamic = "force-dynamic";

/**
 * Admin — Review des brouillons générés par IA.
 *
 * Liste tous les drafts PENDING + les 10 derniers traités (approved/rejected)
 * pour l'audit visuel. Le panel client gère génération + approbation/rejet.
 */
export default async function AIReviewPage() {
  const [pending, history] = await Promise.all([
    db.aIDraft.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.aIDraft.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] } },
      orderBy: { reviewedAt: "desc" },
      take: 10,
    }),
  ]);

  const serializable = [...pending, ...history].map((d) => ({
    id: d.id,
    type: d.type,
    status: d.status,
    payload: d.payload,
    aiModel: d.aiModel,
    rejectReason: d.rejectReason,
    publishedId: d.publishedId,
    createdAt: d.createdAt.toISOString(),
    reviewedAt: d.reviewedAt?.toISOString() ?? null,
    tokensInput: d.tokensInput,
    tokensOutput: d.tokensOutput,
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Sparkles className="h-6 w-6 text-primary" />
            Review IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Brouillons générés par Claude. Approuve pour publier, rejette pour archiver.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-500/40 text-amber-500">
            {pending.length} en attente
          </Badge>
          <Link
            href="/admin"
            className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            ← Admin
          </Link>
        </div>
      </header>

      {pending.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aucun brouillon en attente</CardTitle>
            <CardDescription>
              Génère un premier brouillon ci-dessous. Le modèle (Claude Opus 4.7) rédige
              une quête cohérente avec la taxonomie existante ; tu la valides ou l&apos;édites
              avant publication.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Requiert les variables d&apos;environnement <code>ANTHROPIC_API_KEY</code>{" "}
              et <code>AI_GENERATION_ENABLED=1</code>.
            </p>
          </CardContent>
        </Card>
      )}

      <AIReviewPanel drafts={serializable} />
    </div>
  );
}
