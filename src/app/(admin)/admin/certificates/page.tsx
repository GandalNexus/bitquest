import { ChevronLeft, ChevronRight, FileSignature } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminOrDenied } from "../_require-admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

/**
 * Page admin : liste globale des Certificates émis (LOT 60).
 *
 * Dédiée aux ops pour :
 *   - vérifier le débit d'émission certificats (indicateur usage réel).
 *   - repérer un user qui triggere anormalement d'exports.
 *   - croiser avec /admin/attestations (parent).
 *
 * ADMIN only. Pas d'édition — Certificate.format = "JSON_V1" est
 * immuable (idempotence via unique(attestationId, format)).
 */
export default async function AdminCertificatesPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; format?: string }>;
}) {
  const gate = await requireAdminOrDenied();
  if (!gate.ok) return gate.element;

  const sp = (await searchParams) ?? {};
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const formatFilter = sp.format && /^[A-Z0-9_]{3,16}$/.test(sp.format) ? sp.format : null;
  const where = formatFilter ? { format: formatFilter } : undefined;

  const [rows, total, formatCounts] = await Promise.all([
    db.certificate.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        attestationId: true,
        format: true,
        publicUrl: true,
        issuedAt: true,
        attestation: {
          select: {
            userId: true,
            kind: true,
            targetCode: true,
            user: { select: { pseudo: true } },
          },
        },
      },
    }),
    db.certificate.count({ where }),
    db.certificate.groupBy({
      by: ["format"],
      _count: { _all: true },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string | null> = {
      format: formatFilter,
      page: null,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    return params.toString();
  };
  const formatCountMap = new Map(formatCounts.map((f) => [f.format, f._count._all]));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
            <FileSignature className="h-5 w-5 text-primary" aria-hidden />
            Certificates
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Certificates HMAC-SHA256 émis via l&apos;API
            <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
              /api/me/attestations/[id]/certificate
            </code>
            ({total} au total
            {formatFilter ? ` · ${formatFilter}` : ""}
            {pageCount > 1 ? ` · page ${page}/${pageCount}` : ""}).
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer par format">
        <FilterChip
          href={`/admin/certificates?${qs({ format: null })}`}
          active={formatFilter === null}
          label={`Tous (${total})`}
        />
        {Array.from(formatCountMap.entries()).map(([fmt, count]) => (
          <FilterChip
            key={fmt}
            href={`/admin/certificates?${qs({ format: fmt })}`}
            active={formatFilter === fmt}
            label={`${fmt} (${count})`}
          />
        ))}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aucun Certificate</CardTitle>
            <CardDescription>
              Aucun apprenant n&apos;a exporté de preuve Lightning
              {formatFilter ? ` au format ${formatFilter}` : ""}.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Format</th>
                  <th className="px-4 py-2 font-medium">Attestation parent</th>
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
                        {r.format}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <span className="text-foreground">{r.attestation.kind}</span>
                      {" / "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                        {r.attestation.targetCode}
                      </code>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      @{r.attestation.user?.pseudo ?? "—"}
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
                  href={`/admin/certificates?${qs({ page: String(page - 1) })}`}
                  disabled={page <= 1}
                  label="Précédente"
                  dir="prev"
                />
                <PageLink
                  href={`/admin/certificates?${qs({ page: String(page + 1) })}`}
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
