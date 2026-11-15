import { redirect } from "next/navigation";
import { Award, BookOpen, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRoleSsr } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { ExportCertificateButton } from "./export-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mes attestations — BitQuest",
};

/**
 * Page apprenant « Mes attestations » (LOT 26).
 *
 * Expose le registre immuable des `Attestation` créées par le handler
 * event-bus (`src/lib/handlers/attestations.ts`). Chaque ligne = une
 * preuve cryptographiable future (export NIP/Nostr) que l'apprenant
 * peut porter hors de BitQuest.
 *
 * Lecture seule (pas de delete/edit — manifesto : trace pédagogique).
 */
export default async function MyAttestationsPage() {
  const auth = await requireRoleSsr("APPRENTICE");
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") redirect("/");
    redirect("/dashboard");
  }

  const rows = await db.attestation.findMany({
    where: { userId: auth.user.id },
    orderBy: { issuedAt: "desc" },
    take: 100,
    select: {
      id: true,
      kind: true,
      targetCode: true,
      metadata: true,
      issuedAt: true,
    },
  });

  const questCodes = Array.from(
    new Set(rows.filter((r) => r.kind === "QUEST").map((r) => r.targetCode)),
  );
  const quests = questCodes.length
    ? await db.quest.findMany({
        where: { code: { in: questCodes } },
        select: { code: true, title: true },
      })
    : [];
  const titleByCode = new Map(quests.map((q) => [q.code, q.title]));

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight">
          <Award className="h-7 w-7 text-primary" aria-hidden />
          Mes attestations
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Chaque quête complétée génère une attestation immuable. Tu peux
          télécharger un certificat signé par le serveur ou copier un
          lien partageable que n&apos;importe qui peut vérifier sur{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">/verify</code>.
        </p>
      </header>

      {rows.length > 0 && (
        <section className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
          <div className="mb-1 font-medium text-foreground">
            Comment exporter ta preuve ?
          </div>
          <ol className="list-decimal space-y-0.5 pl-4 leading-relaxed">
            <li>
              Clique <strong>« Exporter »</strong> sur une attestation pour
              télécharger un fichier <code>.txt</code> signé HMAC-SHA256.
            </li>
            <li>
              Ou clique <strong>« Lien »</strong> pour copier une URL
              <code className="mx-1">/verify?blob=…</code> directement
              partageable (recruteur, portfolio, Nostr).
            </li>
            <li>
              Le certificat ne quitte jamais tes mains — c&apos;est à toi
              de le stocker/diffuser. Format{" "}
              <a
                href="/docs/CERTIFICATES_V1"
                className="underline-offset-2 hover:underline"
              >
                CERTIFICATES_V1
              </a>{" "}
              documenté pour les intégrateurs.
            </li>
          </ol>
        </section>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aucune attestation</CardTitle>
            <CardDescription>
              Termine une quête pour recevoir ta première attestation.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const title =
              r.kind === "QUEST"
                ? titleByCode.get(r.targetCode) ?? r.targetCode
                : r.targetCode;
            let meta: { xpEarned?: number; satsEarned?: number } = {};
            try {
              const parsed = JSON.parse(r.metadata) as unknown;
              if (parsed && typeof parsed === "object") {
                meta = parsed as { xpEarned?: number; satsEarned?: number };
              }
            } catch {
              // metadata corrompu → affichage minimal
            }
            return (
              <li key={r.id}>
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <BookOpen className="h-4 w-4 text-primary" aria-hidden />
                          {title}
                        </CardTitle>
                        <CardDescription>
                          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                            {r.targetCode}
                          </code>
                          {" · "}
                          <time dateTime={r.issuedAt.toISOString()}>
                            {r.issuedAt.toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </time>
                        </CardDescription>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-primary/40 bg-primary/10 text-primary"
                      >
                        {r.kind}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div className="flex flex-wrap items-center gap-3">
                      {meta.xpEarned ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          +{meta.xpEarned} XP
                        </span>
                      ) : null}
                      {meta.satsEarned ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Zap className="h-3.5 w-3.5" aria-hidden />
                          +{meta.satsEarned} sats
                        </span>
                      ) : null}
                    </div>
                    <ExportCertificateButton
                      attestationId={r.id}
                      targetCode={r.targetCode}
                    />
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
