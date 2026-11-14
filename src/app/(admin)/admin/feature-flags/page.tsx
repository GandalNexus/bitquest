import { Flag } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminOrDenied } from "../_require-admin";
import { FlagRow } from "./flag-row";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Feature flags — BitQuest Admin",
};

export default async function AdminFeatureFlagsPage() {
  const gate = await requireAdminOrDenied();
  if (!gate.ok) return gate.element;

  const flags = await db.featureFlag.findMany({ orderBy: { key: "asc" } });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
          <Flag className="h-5 w-5 text-primary" aria-hidden />
          Feature flags
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toggle produit sans redéploiement. Les changements prennent effet
          immédiatement — cache in-memory ≤ 60s via <code>isFeatureEnabled</code>.
        </p>
      </header>

      {flags.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aucun flag seedé</CardTitle>
            <CardDescription>
              Les flags sont créés via Prisma seed ou directement en DB. Voir
              <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                prisma/seed.ts
              </code>
              pour le pattern.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="space-y-3">
          {flags.map((f) => (
            <li key={f.id}>
              <FlagRow
                flag={{
                  key: f.key,
                  description: f.description,
                  enabled: f.enabled,
                  userIds: safeParseUserIds(f.userIds),
                  updatedAt: f.updatedAt.toISOString(),
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function safeParseUserIds(raw: string): string[] {
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === "string").slice(0, 100);
  } catch {
    return [];
  }
}
