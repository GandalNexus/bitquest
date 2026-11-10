import { ClipboardList } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const ACTIONS = [
  "ROLE_CHANGE",
  "COURSE_CREATE",
  "COURSE_UPDATE",
  "COURSE_DELETE",
  "CHAPTER_CREATE",
  "CHAPTER_UPDATE",
  "CHAPTER_DELETE",
  "LESSON_CREATE",
  "LESSON_UPDATE",
  "LESSON_DELETE",
  "QUEST_UPDATE",
] as const;

type Action = (typeof ACTIONS)[number];

const actionStyles: Record<string, string> = {
  ROLE_CHANGE: "border-rose-500/40 bg-rose-500/10 text-rose-500",
  COURSE_CREATE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  COURSE_UPDATE: "border-blue-500/40 bg-blue-500/10 text-blue-500",
  COURSE_DELETE: "border-destructive/40 bg-destructive/10 text-destructive",
  CHAPTER_CREATE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  CHAPTER_UPDATE: "border-blue-500/40 bg-blue-500/10 text-blue-500",
  CHAPTER_DELETE: "border-destructive/40 bg-destructive/10 text-destructive",
  LESSON_CREATE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  LESSON_UPDATE: "border-blue-500/40 bg-blue-500/10 text-blue-500",
  LESSON_DELETE: "border-destructive/40 bg-destructive/10 text-destructive",
  QUEST_UPDATE: "border-blue-500/40 bg-blue-500/10 text-blue-500",
};

function formatDateTime(d: Date): string {
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action: actionFilter } = await searchParams;
  const filter = actionFilter && ACTIONS.includes(actionFilter as Action)
    ? (actionFilter as Action)
    : null;

  const [entries, totalCount] = await Promise.all([
    db.adminAuditLog.findMany({
      where: filter ? { action: filter } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { actor: { select: { pseudo: true, role: true } } },
    }),
    db.adminAuditLog.count(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          100 dernières actions admin, triées anti-chronologiquement.
          {totalCount > 100 && ` ${totalCount} entrées au total.`}
        </p>
      </header>

      {/* Filtres */}
      <section className="flex flex-wrap items-center gap-2">
        <FilterChip href="/admin/audit" active={filter === null} label={`Toutes (${totalCount})`} />
        {ACTIONS.map((a) => (
          <FilterChip
            key={a}
            href={`/admin/audit?action=${a}`}
            active={filter === a}
            label={a}
          />
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary" aria-hidden />
            {filter ? `Filtre : ${filter}` : "Toutes les actions"}
          </CardTitle>
          <CardDescription>
            {entries.length} entrée{entries.length > 1 ? "s" : ""} affichée{entries.length > 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Aucune entrée d&apos;audit pour l&apos;instant.
            </p>
          ) : (
            <ul className="divide-y">
              {entries.map((e) => {
                let meta: Record<string, unknown> = {};
                try {
                  meta = JSON.parse(e.meta || "{}");
                } catch {
                  /* meta cassée : conserver {} */
                }
                return (
                  <li key={e.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={actionStyles[e.action] ?? "border-border text-muted-foreground"}
                      >
                        {e.action}
                      </Badge>
                      <span className="text-sm font-medium">{e.actor.pseudo}</span>
                      <span className="text-xs text-muted-foreground">({e.actor.role})</span>
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                        {formatDateTime(e.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{e.resource}</code>
                      {Object.entries(meta).map(([k, v]) => (
                        <span key={k} className="truncate">
                          <strong className="text-foreground">{k}:</strong>{" "}
                          {typeof v === "object" ? JSON.stringify(v) : String(v)}
                        </span>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <a
      href={href}
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
