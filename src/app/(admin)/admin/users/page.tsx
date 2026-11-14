import { Bot, ChevronLeft, ChevronRight, UserCheck, UserRound, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireRoleSsr } from "@/lib/auth/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleForm } from "./role-form";
import { PurgeButton } from "./purge-button";
import { UsersSearchForm } from "./users-search-form";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

/* ============ Formatage ============ */

const roleBadgeStyles: Record<string, string> = {
  ADMIN: "border-rose-500/40 bg-rose-500/10 text-rose-500",
  EDITOR: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  APPRENTICE: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/* ============ Page ============ */

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; view?: string; q?: string; page?: string }>;
}) {
  // Le layout parent (admin/layout.tsx) garantit déjà ADMIN ; on récupère
  // l'id courant pour marquer "toi" sur la bonne ligne.
  const auth = await requireRoleSsr("ADMIN");
  const currentUserId = auth.ok ? auth.user.id : null;

  const sp = await searchParams;
  const filter = sp.role && ["APPRENTICE", "EDITOR", "ADMIN"].includes(sp.role)
    ? sp.role
    : null;
  const showDeleted = sp.view === "deleted";
  const query = (sp.q ?? "").trim().slice(0, 60);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  // Filtre composite : état supprimé + rôle + recherche pseudo (ILIKE Postgres
  // via Prisma `contains, mode: "insensitive"`). Si le filtre rôle est actif
  // alors qu'on regarde les supprimés, on l'ignore (comportement précédent).
  const whereBase = showDeleted
    ? { deletedAt: { not: null } }
    : { deletedAt: null, ...(filter ? { role: filter } : {}) };
  const whereWithSearch = query.length > 0
    ? {
        AND: [whereBase, { pseudo: { contains: query, mode: "insensitive" as const } }],
      }
    : whereBase;

  const skip = (page - 1) * PAGE_SIZE;

  const [users, filteredCount, totalCount, admins, editors, apprentices, deletedCount] =
    await Promise.all([
      db.user.findMany({
        where: whereWithSearch,
        orderBy: showDeleted
          ? [{ deletedAt: "desc" }]
          : [{ role: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          pseudo: true,
          email: true,
          role: true,
          isGuest: true,
          isBot: true,
          xp: true,
          sats: true,
          createdAt: true,
          deletedAt: true,
        },
        skip,
        take: PAGE_SIZE,
      }),
      db.user.count({ where: whereWithSearch }),
      db.user.count({ where: { deletedAt: null } }),
      db.user.count({ where: { deletedAt: null, role: "ADMIN" } }),
      db.user.count({ where: { deletedAt: null, role: "EDITOR" } }),
      db.user.count({ where: { deletedAt: null, role: "APPRENTICE" } }),
      db.user.count({ where: { deletedAt: { not: null } } }),
    ]);

  const pageCount = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < pageCount;
  const prevHref = `/admin/users?${buildQueryString(sp, { page: String(page - 1) })}`;
  const nextHref = `/admin/users?${buildQueryString(sp, { page: String(page + 1) })}`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Utilisateurs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Attribuer des rôles ou consulter les profils. Les changements prennent effet
          immédiatement — la session de la cible est rotée.
        </p>
      </header>

      {/* Compteurs + filtres */}
      <section className="flex flex-wrap items-center gap-2">
        <FilterChip
          href={`/admin/users?${buildQueryString(sp, { role: null, view: null, page: null })}`}
          active={!showDeleted && filter === null}
          label={`Tous (${totalCount})`}
        />
        <FilterChip
          href={`/admin/users?${buildQueryString(sp, { role: "ADMIN", view: null, page: null })}`}
          active={!showDeleted && filter === "ADMIN"}
          label={`Admin (${admins})`}
        />
        <FilterChip
          href={`/admin/users?${buildQueryString(sp, { role: "EDITOR", view: null, page: null })}`}
          active={!showDeleted && filter === "EDITOR"}
          label={`Editor (${editors})`}
        />
        <FilterChip
          href={`/admin/users?${buildQueryString(sp, { role: "APPRENTICE", view: null, page: null })}`}
          active={!showDeleted && filter === "APPRENTICE"}
          label={`Apprentice (${apprentices})`}
        />
        <FilterChip
          href={`/admin/users?${buildQueryString(sp, { role: null, view: "deleted", page: null })}`}
          active={showDeleted}
          label={`Supprimés (${deletedCount})`}
        />
      </section>

      <UsersSearchForm initialQuery={query} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" aria-hidden />
            {filter ? `Filtre : ${filter}` : "Tous les utilisateurs"}
          </CardTitle>
          <CardDescription>
            {filteredCount} résultat{filteredCount > 1 ? "s" : ""}
            {pageCount > 1 ? ` · page ${page}/${pageCount}` : ""}
            {query ? ` · pseudo contient « ${query} »` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Pseudo</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Rôle</th>
                <th className="px-4 py-2 font-medium">XP</th>
                <th className="px-4 py-2 font-medium">
                  {showDeleted ? "Supprimé le" : "Créé le"}
                </th>
                <th className="px-4 py-2 font-medium">
                  {showDeleted ? "Purge" : "Changer"}
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {u.isBot ? (
                          <Bot className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        ) : u.isGuest ? (
                          <UserRound className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        )}
                        {u.pseudo}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{u.email ?? "—"}</td>
                    <td className="px-4 py-2">
                      <Badge
                        variant="outline"
                        className={roleBadgeStyles[u.role] ?? roleBadgeStyles.APPRENTICE}
                      >
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">
                      {u.xp.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {showDeleted && u.deletedAt
                        ? formatDate(u.deletedAt)
                        : formatDate(u.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      {showDeleted ? (
                        <PurgeButton userId={u.id} pseudo={u.pseudo} />
                      ) : (
                        <RoleForm
                          userId={u.id}
                          pseudo={u.pseudo}
                          currentRole={u.role}
                          isSelf={isSelf}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {query ? `Aucun utilisateur ne matche « ${query} ».` : "Aucun utilisateur dans ce filtre."}
            </p>
          )}
        </CardContent>
        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
            <span>
              {skip + 1}–{Math.min(skip + users.length, filteredCount)} sur {filteredCount}
            </span>
            <div className="flex items-center gap-1">
              <PageLink href={prevHref} disabled={!canPrev} label="Précédente" direction="prev" />
              <PageLink href={nextHref} disabled={!canNext} label="Suivante" direction="next" />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * Construit une nouvelle querystring à partir de searchParams en
 * appliquant `overrides` : `null` → supprime la clé, autre → remplace.
 * Les clés absentes des overrides sont conservées telles quelles.
 */
function buildQueryString(
  current: { role?: string; view?: string; q?: string; page?: string },
  overrides: Partial<Record<"role" | "view" | "q" | "page", string | null>>,
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v === null || v === undefined || v === "") continue;
    params.set(k, v);
  }
  return params.toString();
}

function PageLink({
  href,
  disabled,
  label,
  direction,
}: {
  href: string;
  disabled: boolean;
  label: string;
  direction: "prev" | "next";
}) {
  if (disabled) {
    return (
      <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border px-2 py-1 text-muted-foreground/50">
        {direction === "prev" && <ChevronLeft className="h-3.5 w-3.5" aria-hidden />}
        {label}
        {direction === "next" && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
      </span>
    );
  }
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 transition-colors hover:border-primary/40 hover:text-foreground"
    >
      {direction === "prev" && <ChevronLeft className="h-3.5 w-3.5" aria-hidden />}
      {label}
      {direction === "next" && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
    </a>
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
