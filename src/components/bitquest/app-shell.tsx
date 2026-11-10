"use client";

import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBitQuest, type View } from "@/lib/bitquest/store";
import { useMe } from "@/lib/bitquest/hooks";
import { clearStoredSession } from "@/lib/bitquest/client";
import { XpBar } from "./ui-bits";
import { OrbiteMark, QuestBubble } from "./brand";
import { formatSats } from "@/lib/bitquest/client";
import {
  LayoutDashboard,
  Map,
  User,
  Wallet,
  Trophy,
  Flame,
  Coins,
  LogOut,
  Sun,
  Moon,
  Compass,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const NAV: { view: View; href: string; label: string; icon: LucideIcon }[] = [
  { view: "dashboard", href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { view: "quests", href: "/quests", label: "Quêtes", icon: Map },
  { view: "profile", href: "/profile", label: "Profil", icon: User },
  { view: "wallet", href: "/wallet", label: "Wallet", icon: Wallet },
  { view: "leaderboard", href: "/leaderboard", label: "Classement", icon: Trophy },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const view = useBitQuest((s) => s.view);
  const setView = useBitQuest((s) => s.setView);
  const user = useBitQuest((s) => s.user);
  const logout = useBitQuest((s) => s.logout);
  const { data } = useMe();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  /** Détermine l'onglet actif : URL si on est sur une route /dashboard|/quests|…, sinon store.view (mode SPA /) */
  const isRouteMode = pathname !== null && pathname !== "/" && !pathname.startsWith("/academy");
  const isActive = (href: string, v: View) => {
    if (isRouteMode) return pathname === href || pathname.startsWith(href + "/");
    return view === v;
  };

  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(t);
  }, []);

  const me = data?.user ?? user;

  const handleLogout = () => {
    clearStoredSession();
    logout();
    window.location.reload();
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Champ d'étoiles (mode Nuit Web3 uniquement) */}
      <div aria-hidden className="starfield" />

      {/* ===== Header ===== */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          {/* Lockup BitQuest : logo + bulle « Quest » (même pattern que « Lab » dans BitLab) */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2"
            aria-label="BitQuest — accueil"
            onClick={() => setView("dashboard")}
          >
            <OrbiteMark className="h-8 w-8 shrink-0 text-foreground" />
            <QuestBubble className="hidden min-[400px]:inline-block" />
          </Link>

          {/* Stats */}
          {me && (
            <div className="ml-2 hidden min-w-0 flex-1 items-center gap-2 md:flex">
              <Badge variant="outline" className="gap-1.5 border-primary/40 bg-primary/5">
                <Compass className="h-3.5 w-3.5 text-primary" />
                <span className="font-display font-semibold">Nv. {me.levelInfo.level}</span>
                <span className="hidden text-muted-foreground lg:inline">· {me.levelInfo.title}</span>
              </Badge>
              <div className="w-32 xl:w-44">
                <XpBar levelInfo={me.levelInfo} compact />
              </div>
              <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/5 text-amber-500">
                <Coins className="h-3.5 w-3.5" />
                {formatSats(me.sats)} sats
              </Badge>
              <Badge variant="outline" className="gap-1 border-orange-500/40 bg-orange-500/5 text-orange-500">
                <Flame className="h-3.5 w-3.5" />
                {me.streak} j
              </Badge>
            </div>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              aria-label={theme === "dark" ? "Passer en thème clair" : "Passer en thème sombre"}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {mounted && theme === "dark" ? (
                <Sun className="h-4.5 w-4.5" />
              ) : (
                <Moon className="h-4.5 w-4.5" />
              )}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Se déconnecter" onClick={handleLogout}>
              <LogOut className="h-4.5 w-4.5" />
            </Button>
          </div>
        </div>

        {/* Stats mobile */}
        {me && (
          <div className="flex items-center gap-2 overflow-x-auto border-t px-4 py-2 md:hidden">
            <Badge variant="outline" className="shrink-0 border-primary/40 text-primary">
              Nv. {me.levelInfo.level} · {me.levelInfo.title}
            </Badge>
            <div className="w-24 shrink-0">
              <XpBar levelInfo={me.levelInfo} compact />
            </div>
            <Badge variant="outline" className="shrink-0 border-amber-500/40 text-amber-500">
              <Coins className="h-3 w-3" /> {formatSats(me.sats)}
            </Badge>
            <Badge variant="outline" className="shrink-0 border-orange-500/40 text-orange-500">
              <Flame className="h-3 w-3" /> {me.streak} j
            </Badge>
          </div>
        )}

        {/* Nav desktop */}
        <nav aria-label="Navigation principale" className="hidden border-t md:block">
          <div className="mx-auto flex w-full max-w-6xl gap-1 px-4">
            {NAV.map((item) => {
              const active = isActive(item.href, item.view);
              return (
                <Link
                  key={item.view}
                  href={item.href}
                  onClick={() => setView(item.view)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {/* ===== Contenu ===== */}
      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 md:pb-10">
        {children}
      </main>

      {/* ===== Nav mobile (bas) ===== */}
      <nav
        aria-label="Navigation mobile"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/95 backdrop-blur md:hidden"
      >
        {NAV.map((item) => {
          const active = isActive(item.href, item.view);
          return (
            <Link
              key={item.view}
              href={item.href}
              onClick={() => setView(item.view)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>

      {/* ===== Footer sticky ===== */}
      <footer className="relative z-10 mt-auto border-t bg-card/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <OrbiteMark className="h-4 w-4 text-foreground" />
            <span className="font-display font-bold tracking-wide">
              <span className="text-primary">BIT</span>QUEST
            </span>
            <span>· open-source — de l&apos;Afrique vers le monde</span>
          </div>
          <div className="text-center sm:text-right">
            Sandbox Testnet — les satoshis sont pédagogiques et plafonnés.
          </div>
        </div>
      </footer>
    </div>
  );
}
