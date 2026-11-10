import { Bot, UserCheck, UserRound, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireRoleSsr } from "@/lib/auth/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleForm } from "./role-form";

export const dynamic = "force-dynamic";

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
  searchParams: Promise<{ role?: string }>;
}) {
  // Le layout parent (admin/layout.tsx) garantit déjà ADMIN ; on récupère
  // l'id courant pour marquer "toi" sur la bonne ligne.
  const auth = await requireRoleSsr("ADMIN");
  const currentUserId = auth.ok ? auth.user.id : null;

  const { role: roleFilter } = await searchParams;
  const filter = roleFilter && ["APPRENTICE", "EDITOR", "ADMIN"].includes(roleFilter)
    ? roleFilter
    : null;

  const users = await db.user.findMany({
    where: { deletedAt: null, ...(filter ? { role: filter } : {}) },
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
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
    },
  });

  const [totalCount, admins, editors, apprentices] = await Promise.all([
    db.user.count({ where: { deletedAt: null } }),
    db.user.count({ where: { deletedAt: null, role: "ADMIN" } }),
    db.user.count({ where: { deletedAt: null, role: "EDITOR" } }),
    db.user.count({ where: { deletedAt: null, role: "APPRENTICE" } }),
  ]);

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
        <FilterChip href="/admin/users" active={filter === null} label={`Tous (${totalCount})`} />
        <FilterChip
          href="/admin/users?role=ADMIN"
          active={filter === "ADMIN"}
          label={`Admin (${admins})`}
        />
        <FilterChip
          href="/admin/users?role=EDITOR"
          active={filter === "EDITOR"}
          label={`Editor (${editors})`}
        />
        <FilterChip
          href="/admin/users?role=APPRENTICE"
          active={filter === "APPRENTICE"}
          label={`Apprentice (${apprentices})`}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" aria-hidden />
            {filter ? `Filtre : ${filter}` : "Tous les utilisateurs"}
          </CardTitle>
          <CardDescription>
            {users.length} résultat{users.length > 1 ? "s" : ""}
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
                <th className="px-4 py-2 font-medium">Créé le</th>
                <th className="px-4 py-2 font-medium">Changer</th>
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
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-2">
                      <RoleForm
                        userId={u.id}
                        pseudo={u.pseudo}
                        currentRole={u.role}
                        isSelf={isSelf}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Aucun utilisateur dans ce filtre.
            </p>
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
