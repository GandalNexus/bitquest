import Link from "next/link";
import {
  Activity,
  BookOpen,
  ClipboardList,
  Flame,
  FlaskConical,
  LayoutDashboard,
  Lock,
  LogIn,
  Map,
  ShieldAlert,
  Trophy,
  Users,
  UsersRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { requireRoleSsr } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Admin — BitQuest",
  description: "Console d'administration BitQuest",
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** `"ADMIN"` → visible ADMIN uniquement. Sinon visible à partir d'EDITOR. */
  minRole?: "EDITOR" | "ADMIN";
};

/**
 * Nav admin complète. `minRole: "ADMIN"` filtre les entrées sensibles
 * (gestion users, audit, modération gamification) hors de la vue EDITOR.
 */
const NAV: NavItem[] = [
  { href: "/admin", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/admin/users", label: "Utilisateurs", icon: Users, minRole: "ADMIN" },
  { href: "/admin/courses", label: "Cours", icon: BookOpen },
  { href: "/admin/quests", label: "Quêtes", icon: Map },
  { href: "/admin/badges", label: "Badges", icon: Trophy, minRole: "ADMIN" },
  { href: "/admin/challenges", label: "Défis", icon: Flame, minRole: "ADMIN" },
  { href: "/admin/team-members", label: "Équipe", icon: UsersRound, minRole: "ADMIN" },
  { href: "/admin/bitlab/attempts", label: "BitLab preuves", icon: FlaskConical, minRole: "ADMIN" },
  { href: "/admin/lightning-rewards", label: "Lightning rewards", icon: Zap, minRole: "ADMIN" },
  { href: "/admin/audit", label: "Audit log", icon: ClipboardList, minRole: "ADMIN" },
  { href: "/admin/health", label: "État service", icon: Activity, minRole: "ADMIN" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // EDITOR+ peut accéder ; les pages ADMIN-only (users, audit, badges, challenges,
  // bitlab/attempts, health) vérifient à nouveau leur propre guard SSR.
  const gate = await requireRoleSsr("EDITOR");

  if (!gate.ok) {
    return <AccessDenied reason={gate.reason} />;
  }

  const isAdmin = gate.user.role === "ADMIN";
  const brandLabel = isAdmin ? "ADMIN" : "STUDIO";
  const brandClass = isAdmin
    ? "bg-primary/10 text-primary"
    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  const visibleNav = NAV.filter((item) => !item.minRole || isAdmin);

  return (
    <div className="min-h-screen bg-background">
      {/* Topbar */}
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2 font-display font-bold">
            <span className={`rounded-md px-2 py-1 text-xs ${brandClass}`}>{brandLabel}</span>
            <span>
              <span className="text-primary">BIT</span>QUEST
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="hidden sm:inline">
              Connecté·e : <strong>{gate.user.pseudo}</strong> · {gate.user.role}
            </span>
            <Button asChild variant="outline" size="sm">
              <Link href="/">Retour à l&apos;app</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Shell admin : sidebar + contenu */}
      <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav aria-label="Navigation admin" className="space-y-1">
            {visibleNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <item.icon className="h-4 w-4" aria-hidden />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function AccessDenied({ reason }: { reason: "unauthenticated" | "forbidden" }) {
  const isUnauth = reason === "unauthenticated";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md space-y-4 rounded-xl border bg-card p-8 text-center">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            {isUnauth ? (
              <Lock className="h-6 w-6" aria-hidden />
            ) : (
              <ShieldAlert className="h-6 w-6" aria-hidden />
            )}
          </div>
        </div>
        <h1 className="font-display text-2xl font-bold">
          {isUnauth ? "Session requise" : "Accès refusé"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isUnauth
            ? "Connecte-toi d'abord à BitQuest pour accéder à la console admin."
            : "Cette zone est réservée aux administrateurs. Si tu penses que c'est une erreur, contacte un admin."}
        </p>
        <div className="flex justify-center gap-2">
          <Button asChild variant="outline">
            <Link href="/">Retour à l&apos;app</Link>
          </Button>
          {isUnauth && (
            <Button asChild>
              <Link href="/">
                <LogIn className="h-4 w-4" aria-hidden />
                Se connecter
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
