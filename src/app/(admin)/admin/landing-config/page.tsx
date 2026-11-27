import { Globe } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminOrDenied } from "../_require-admin";
import { LandingConfigForm } from "./landing-config-form";

export const dynamic = "force-dynamic";

const SINGLETON_ID = "singleton";

const DEFAULTS = {
  bitquestUrl: "https://bitquest.gandalnexus.com",
  bitlabUrl: "https://bitlab.gandalnexus.com",
  landingUrl: "https://gandalnexus.com",
  githubOrgUrl: "https://github.com/GandalNexus",
  verifyUrl: "https://bitquest.gandalnexus.com/verify",
};

export default async function AdminLandingConfigPage() {
  const gate = await requireAdminOrDenied();
  if (!gate.ok) return gate.element;

  const config = await db.landingConfig.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...DEFAULTS },
    update: {},
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Configuration landing
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            URL exposées par le repo <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">GandalNexus/landing</code>{" "}
            via l&apos;endpoint public <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">GET /api/public/landing-config</code>.
            Change-les à tout moment si l&apos;hébergement migre — la landing statique les prendra en compte
            dans la minute (cache CDN 60 s).
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4 text-primary" aria-hidden />
            URL de redirection
          </CardTitle>
          <CardDescription>
            Toutes les URL doivent commencer par <code className="font-mono">http://</code> ou{" "}
            <code className="font-mono">https://</code>. La landing retombe sur ses defaults codés en dur si
            l&apos;API est injoignable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LandingConfigForm
            initial={{
              bitquestUrl: config.bitquestUrl,
              bitlabUrl: config.bitlabUrl,
              landingUrl: config.landingUrl,
              githubOrgUrl: config.githubOrgUrl,
              verifyUrl: config.verifyUrl,
              contactEmail: config.contactEmail ?? "",
              twitterUrl: config.twitterUrl ?? "",
              nostrPubkey: config.nostrPubkey ?? "",
              docsUrl: config.docsUrl ?? "",
            }}
            updatedAt={config.updatedAt.toISOString()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
