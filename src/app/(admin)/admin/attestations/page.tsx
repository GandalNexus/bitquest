import { Award, ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminOrDenied } from "../_require-admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const KINDS = ["QUEST", "COURSE", "BADGE_EARNED"] as const;

/**
 * Page admin : liste globale des Attestations (LOT 37).
 *
 * Dédiée aux ops pour :
 *   - monitorer le volume de certifications émises (débit normal ?)
 *   - repérer un user qui triggere anormalement d'Attestations
 *   - croiser avec le volume Certificate émis
 *
 * ADMIN only — pas d'export CSV ici (les attestations sont
 * accessibles chacune via la page apprenant via Prisma studio).
 */
export default async function AdminAttestationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ kind?: string; userId?: string; page?: string }>;
}) {
  const gate = await requireAdminOrDenied();
  if (!gate.ok) return gate.element;

  const sp = (await searchParams) ?? {};
  const kindFilter = (KINDS as readonly string[]).includes(sp.kind ?? "")
    ? (sp.kind as string)
    : null;
  const userIdFilter = (sp.userId ?? "").trim().slice(0, 40) || null;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const where = {
    ...(kindFilter ? { kind: kindFilter } : {}),
    ...(userIdFilter ? { userId: userIdFilter } : {}),
  };

  const [rows, total, kindCounts] = await Promise.all([
    db.attestation.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        userId: true,
        kind: true,
        targetCode: true,
        issuedAt: true,
      },
    }),
    db.attestation.count({ where }),
    db.attestation.groupBy({
      by: ["kind"],
      _count: { _all: true },
    }),
  ]);

  // Lookup pseudos en batch (pas de relation Prisma Attestation → User
  // dans le schéma : additif à faire si besoin, pour l'instant on bat
  // la requête distinct).
  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  const users = userIds.length
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, pseudo: true },
      })
    : [];
  const pseudoById = new Map(users.map((u) => [u.id, u.pseudo]));

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string | null> = {
      kind: kindFilter,
      userId: userIdFilter,
      page: null,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    return params.toString();
  };

  const kindCountMap = new Map(kindCounts.map((k) => [k.kind, k._count._all]));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
            <Award className="h-5 w-5 text-primary" aria-hidden />
            Attestations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Toutes les Attestations immuables émises par
            <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
              event-bus → handler
            </code>
            ({total} au total
            {kindFilter ? ` · ${kindFilter}` : ""}
            {userIdFilter ? ` · user ${userIdFilter}` : ""}
            {pageCount > 1 ? ` · page ${page}/${pageCount}` : ""}).
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer par kind">
        <FilterChip href={`/admin/attestations?${qs({ kind: null })}`} active={kindFilter === null} label={`Tous (${total})`} />
        {KINDS.map((k) => (
          <FilterChip
            key={k}
            href={`/admin/attestations?${qs({ kind: k })}`}
            active={kindFilter === k}
            label={`${k} (${kindCountMap.get(k) ?? 0})`}
          />
        ))}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aucune Attestation</CardTitle>
            <CardDescription>
              {userIdFilter
                ? `Pas d'Attestation pour l'user ${userIdFilter}.`
                : kindFilter
                  ? `Pas d'Attestation de kind ${kindFilter}.`
                  : "La table est vide — aucune quête n'a encore été complétée côté serveur."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Kind</th>
                  <th className="px-4 py-2 font-medium">Target</th>
                  <th className="px-4 py-2 font-medium">User</th>
                  <th className="px-4 py-2 font-medium">Émis le</th>
                  <th className="px-4 py-2 font-medium">ID</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <Badge
                        variant="outline"
                        className="border-primary/40 bg-primary/10 text-primary"
                      >
                        {r.kind}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                        {r.targetCode}
                      </code>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      @{pseudoById.get(r.userId) ?? "—"}
                      <code className="ml-1.5 text-[10px]">{r.userId}</code>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground tabular-nums">
                      {r.issuedAt.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-2 text-[10px] text-muted-foreground">
                      <code>{r.id}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
          {pageCount > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
              <span>
                Page {page} / {pageCount}
              </span>
              <div className="flex items-center gap-1">
                <PageLink
                  href={`/admin/attestations?${qs({ page: String(page - 1) })}`}
                  disabled={page <= 1}
                  label="Précédente"
                  dir="prev"
                />
                <PageLink
                  href={`/admin/attestations?${qs({ page: String(page + 1) })}`}
                  disabled={page >= pageCount}
                  label="Suivante"
                  dir="next"
                />
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
      }`}
    >
      {label}
    </a>
  );
}

function PageLink({
  href,
  disabled,
  label,
  dir,
}: {
  href: string;
  disabled: boolean;
  label: string;
  dir: "prev" | "next";
}) {
  if (disabled) {
    return (
      <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border px-2 py-1 text-muted-foreground/50">
        {dir === "prev" && <ChevronLeft className="h-3.5 w-3.5" aria-hidden />}
        {label}
        {dir === "next" && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
      </span>
    );
  }
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:border-primary/40 hover:text-foreground"
    >
      {dir === "prev" && <ChevronLeft className="h-3.5 w-3.5" aria-hidden />}
      {label}
      {dir === "next" && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
    </a>
  );
}
