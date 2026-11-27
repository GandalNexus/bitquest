import { CheckCircle2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { verifyCertificate } from "@/lib/certificates/sign";
import { PublicNav } from "@/components/bitquest/public-nav";
import { CertificateDownload } from "./certificate-download";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Vérifier un certificat — BitQuest",
  description:
    "Vérifier la signature d'un certificat BitQuest émis via /attestations.",
};

/**
 * Page publique de vérification d'un Certificate BitQuest (LOT 30).
 *
 * URL : /verify?blob=<signed>
 *
 * - Pas d'auth (anonyme accepté).
 * - La vérification se fait server-side via verifyCertificate() qui
 *   réutilise CERT_SIGN_SECRET → le visiteur n'a aucun secret.
 * - Si pas de blob ou blob invalide : affiche un écran d'aide avec
 *   formulaire manuel pour coller le blob.
 * - Si blob valide : affiche le payload canonique + badge "Vérifié".
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams?: Promise<{ blob?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const rawBlob = sp.blob?.trim() ?? "";

  let state: "idle" | "ok" | "ko" = "idle";
  let payload: ReturnType<typeof verifyCertificate> | null = null;
  let error: string | null = null;

  if (rawBlob) {
    if (rawBlob.length > 8192 || rawBlob.length < 10) {
      state = "ko";
      error = "Blob malformé (longueur hors bornes).";
    } else {
      try {
        payload = verifyCertificate(rawBlob);
        state = "ok";
      } catch (err) {
        state = "ko";
        error = err instanceof Error ? err.message : "Vérification échouée.";
      }
    }
  }

  return (
    <>
      <PublicNav />
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Vérifier un certificat
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Les certificats BitQuest sont signés HMAC-SHA256 par l&apos;instance
          émettrice. Cette page confirme leur authenticité sans révéler le
          secret de signature.
        </p>
      </header>

      {state === "idle" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comment vérifier ?</CardTitle>
            <CardDescription>
              Colle le contenu du fichier <code>.txt</code> téléchargé depuis
              <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                /attestations
              </code>
              ou reçois une URL de la forme
              <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                ?blob=…
              </code>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form method="GET" action="/verify" className="space-y-2">
              <label htmlFor="blob-input" className="text-xs text-muted-foreground">
                Blob signé (3 parties séparées par points)
              </label>
              <textarea
                id="blob-input"
                name="blob"
                placeholder="v1.eyJ…xyz.abc…"
                rows={5}
                className="w-full rounded-md border bg-background p-2 font-mono text-xs"
                maxLength={8192}
              />
              <button
                type="submit"
                className="rounded-md border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Vérifier
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      {state === "ok" && payload && (
        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
              Certificat vérifié
            </CardTitle>
            <CardDescription>
              Signature HMAC valide sur cette instance BitQuest.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 text-sm">
              <Row label="Type">
                <Badge
                  variant="outline"
                  className="border-primary/40 bg-primary/10 text-primary"
                >
                  {payload.kind}
                </Badge>
              </Row>
              <Row label="Cible">
                <span className="font-medium">{payload.targetTitle}</span>
                <code className="ml-2 rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                  {payload.targetCode}
                </code>
              </Row>
              <Row label="Titulaire">
                <span className="font-medium">@{payload.pseudo}</span>
                <code className="ml-2 rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                  {payload.userId}
                </code>
              </Row>
              <Row label="Émetteur">{payload.issuer}</Row>
              <Row label="Émis le">
                {new Date(payload.issuedAt).toLocaleString("fr-FR")}
              </Row>
              <Row label="Certificat">
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                  {payload.certificateId}
                </code>
              </Row>
            </div>
            {payload.metadata && Object.keys(payload.metadata).length > 0 && (
              <details className="rounded-md border bg-background/40 p-2 text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Metadata complète ({Object.keys(payload.metadata).length}{" "}
                  champs)
                </summary>
                <pre className="mt-2 overflow-x-auto font-mono text-[10px]">
                  {JSON.stringify(payload.metadata, null, 2)}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {state === "ok" && payload && <CertificateDownload payload={payload} />}

      {state === "ko" && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <ShieldAlert className="h-5 w-5" aria-hidden />
              Certificat invalide
            </CardTitle>
            <CardDescription>
              {error ??
                "Signature non reconnue par cette instance. Le certificat provient-il du bon serveur ?"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href="/verify"
              className="text-sm text-muted-foreground underline-offset-2 hover:underline"
            >
              ← Recommencer avec un autre blob
            </a>
          </CardContent>
        </Card>
      )}

      <section className="rounded-md border bg-muted/20 p-4 text-xs text-muted-foreground">
        <h2 className="mb-2 font-display text-sm font-semibold text-foreground">
          Comment ça marche ?
        </h2>
        <ul className="space-y-1.5 leading-relaxed">
          <li>
            • Un certificat BitQuest est la trace immuable d&apos;une quête
            Bitcoin complétée par un apprenant sur la plateforme.
          </li>
          <li>
            • Il contient : type (QUEST), code pédagogique, titre humain,
            pseudo du titulaire, date d&apos;émission, XP/sats earned.
          </li>
          <li>
            • Le blob est signé <strong>HMAC-SHA256</strong> par l&apos;instance
            émettrice (version <code>v1</code>). Cette page re-calcule la
            signature avec le secret serveur pour confirmer l&apos;authenticité
            sans jamais exposer le secret.
          </li>
          <li>
            • Une évolution future <code>v2</code> utilisera Schnorr-secp256k1
            pour permettre la vérification offline par n&apos;importe quel
            relay Nostr (NIP-11 auto-découverte).
          </li>
          <li>
            • Le certificat ne quitte pas l&apos;utilisateur — c&apos;est à
            lui de le partager (fichier <code>.txt</code>, URL
            <code>?blob=…</code>, email).
          </li>
        </ul>
      </section>
    </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-muted/40 py-1.5 last:border-0">
      <span className="w-24 shrink-0 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm">
        {children}
      </span>
    </div>
  );
}
