import Link from "next/link";
import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  Lock,
  LogIn,
  Map,
  PenSquare,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { requireRoleSsr } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Studio — BitQuest",
  description: "Espace éditorial BitQuest : cours, chapitres, leçons et quêtes.",
};

/** Nav Studio : pure création de contenu pédagogique. Pas de users/audit/badges. */
const NAV = [
  { href: "/studio", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/studio/courses", label: "Cours", icon: GraduationCap },
  { href: "/studio/chapters", label: "Chapitres", icon: BookOpen },
  { href: "/studio/lessons", label: "Leçons", icon: PenSquare },
  { href: "/studio/quests", label: "Quêtes", icon: Map },
];

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const gate = await requireRoleSsr("EDITOR");

  if (!gate.ok) {
    return <AccessDenied reason={gate.reason} />;
  }

  const isAdmin = gate.user.role === "ADMIN";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/studio" className="flex items-center gap-2 font-display font-bold">
            <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs text-emerald-600 dark:text-emerald-400">
              STUDIO
            </span>
            <span>
              <span className="text-primary">BIT</span>QUEST
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="hidden sm:inline">
              Connecté·e : <strong>{gate.user.pseudo}</strong> · {gate.user.role}
            </span>
            {isAdmin && (
              <Button asChild variant="outline" size="sm">
                <Link href="/admin">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  Admin
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href="/">Retour à l&apos;app</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav aria-label="Navigation studio" className="space-y-1">
            {NAV.map((item) => (
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
            ? "Connecte-toi d'abord à BitQuest pour accéder au Studio."
            : "Le Studio est réservé aux rédacteurs et administrateurs. Demande à un admin de t'attribuer le rôle EDITOR."}
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
