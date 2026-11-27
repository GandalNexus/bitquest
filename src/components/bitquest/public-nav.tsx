"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  Map,
  Moon,
  Sparkles,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OrbiteMark, QuestBubble } from "./brand";

/**
 * Nav slim pour les pages publiques/semi-publiques qui n'héritent pas de
 * l'`AppShell` (academy, verify, gandalnexus). Donne au visiteur anonyme
 * ou connecté un moyen clair de revenir à l'app BitQuest ou d'aller à
 * BitLab, sans passer par la touche "précédent" du navigateur.
 *
 * - Pas de hooks d'auth → safe pour pages anonymes.
 * - Thème géré ici (next-themes) comme `AppShell`.
 * - Active state basé sur pathname (exact ou prefix).
 */

const NAV: Array<{ href: string; label: string; icon: LucideIcon; external?: boolean }> = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/quests", label: "Quêtes", icon: Map },
  { href: "/academy", label: "Académie", icon: GraduationCap },
];

export function PublicNav() {
  const pathname = usePathname() ?? "";
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const bitlabUrl = process.env.NEXT_PUBLIC_BITLAB_URL ?? "http://localhost:3001";
  // URL de la landing (hub public). Admin-configurable via env var ;
  // par défaut on pointe sur gandalnexus.com qui héberge le repo
  // `GandalNexus/landing`.
  const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL ?? "https://gandalnexus.com";

  // `theme` est `undefined` au SSR (next-themes lit le localStorage côté
  // client uniquement). Sans guard `mounted`, le aria-label calculé
  // côté serveur ne matche pas celui du premier render client → warning
  // d'hydratation React. On attend que `mounted` soit true pour afficher
  // la valeur réelle ; au SSR / premier render client on se contente de
  // « Changer de thème » qui est valide dans les deux cas.
  const themeLabel = !mounted
    ? "Changer de thème"
    : theme === "dark"
      ? "Thème clair"
      : "Thème sombre";

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2" aria-label="Accueil BitQuest">
          <OrbiteMark className="h-8 w-8 shrink-0 text-foreground" />
          <QuestBubble className="hidden min-[400px]:inline-block" />
        </Link>

        {/* Retour à la landing publique GandalNexus (hub) — distinct du
            lien "Accueil BitQuest" qui pointe sur /. Utile quand l'user
            arrive depuis gandalnexus.com et veut revenir en arrière. */}
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          title="Retour à la landing GandalNexus"
        >
          <a href={landingUrl} rel="noopener">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            <span className="hidden min-[520px]:inline">Nexus</span>
          </a>
        </Button>

        <nav
          aria-label="Navigation BitQuest"
          className="ml-auto hidden items-center gap-1 sm:flex"
        >
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Button
                key={item.href}
                asChild
                variant="ghost"
                size="sm"
                className={cn(
                  "gap-1.5",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Link href={item.href} aria-current={active ? "page" : undefined}>
                  <item.icon className="h-4 w-4" aria-hidden />
                  <span>{item.label}</span>
                </Link>
              </Button>
            );
          })}
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-1.5 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
          >
            <a href={bitlabUrl} rel="noopener noreferrer">
              <FlaskConical className="h-4 w-4" aria-hidden />
              BitLab
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={themeLabel}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {mounted && theme === "dark" ? (
              <Sun className="h-4.5 w-4.5" />
            ) : (
              <Moon className="h-4.5 w-4.5" />
            )}
          </Button>
        </nav>

        {/* Mobile : juste BitLab + thème (icônes seules) */}
        <nav aria-label="Navigation mobile" className="ml-auto flex items-center gap-1 sm:hidden">
          <Button
            asChild
            variant="outline"
            size="icon"
            className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
            aria-label="Ouvrir BitLab"
          >
            <a href={bitlabUrl} rel="noopener noreferrer">
              <FlaskConical className="h-4 w-4" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={themeLabel}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {mounted && theme === "dark" ? (
              <Sun className="h-4.5 w-4.5" />
            ) : (
              <Moon className="h-4.5 w-4.5" />
            )}
          </Button>
        </nav>
      </div>

      {/* Nav mobile en seconde ligne sur petits écrans — scroll horizontal */}
      <nav
        aria-label="Navigation mobile BitQuest"
        className="flex items-center gap-1 overflow-x-auto border-t px-4 py-1.5 sm:hidden"
      >
        {NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="h-3.5 w-3.5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
