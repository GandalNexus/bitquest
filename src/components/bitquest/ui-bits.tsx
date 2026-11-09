"use client";

import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Boxes, BookOpen, Coins, Flame, Gem, Star, Trophy, Loader2, type LucideIcon } from "lucide-react";
import type { LevelInfo } from "@/lib/bitquest/client";
import { formatSats } from "@/lib/bitquest/client";
import type { ReactNode } from "react";

/* ============ Styles partagés ============ */

export const trackStyles: Record<
  string,
  { label: string; badge: string; dot: string; ring: string; text: string }
> = {
  INITIATION: {
    label: "Initiation",
    badge: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/40",
    text: "text-emerald-500",
  },
  INTERMEDIATE: {
    label: "Intermédiaire",
    badge: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    dot: "bg-amber-500",
    ring: "ring-amber-500/40",
    text: "text-amber-500",
  },
  ADVANCED: {
    label: "Avancé",
    badge: "bg-rose-500/15 text-rose-500 border-rose-500/30",
    dot: "bg-rose-500",
    ring: "ring-rose-500/40",
    text: "text-rose-500",
  },
  SPECIAL: {
    label: "Événement",
    badge: "bg-violet-500/15 text-violet-500 border-violet-500/30",
    dot: "bg-violet-500",
    ring: "ring-violet-500/40",
    text: "text-violet-500",
  },
};

export const rarityStyles: Record<string, { label: string; badge: string; glow: string }> = {
  COMMON: { label: "Commun", badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30", glow: "" },
  RARE: {
    label: "Rare",
    badge: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    glow: "shadow-[0_0_18px_-4px] shadow-amber-500/40",
  },
  EPIC: {
    label: "Épique",
    badge: "bg-violet-500/15 text-violet-500 border-violet-500/30",
    glow: "shadow-[0_0_22px_-4px] shadow-violet-500/50",
  },
};

export const statusLabels: Record<string, string> = {
  AVAILABLE: "Disponible",
  IN_PROGRESS: "En cours",
  THEORY_DONE: "Théorie lue",
  QUIZ_PASSED: "Quiz validé",
  COMPLETED: "Terminée",
};

/* ============ Icônes par nom (badges) ============ */

const ICONS: Record<string, LucideIcon> = {
  Rocket: Trophy,
  BookOpen,
  KeyRound: Star,
  Boxes,
  Zap: Flame,
  Pickaxe: Gem,
  Trophy,
  ShieldCheck: Star,
  Flame,
  Star,
  Crown: Gem,
  Gem,
  Wallet: Coins,
  Medal: Trophy,
  Sparkles: Star,
  Coins,
};

export function BadgeIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICONS[icon] ?? Star;
  return <Icon className={className} />;
}

/* ============ Barre d'XP ============ */

export function XpBar({ levelInfo, compact }: { levelInfo: LevelInfo; compact?: boolean }) {
  if (compact) {
    /* Version compacte : la barre seule — le niveau est affiché par le badge adjacent */
    return (
      <Progress
        value={levelInfo.pct}
        className="h-2"
        aria-label={`Niveau ${levelInfo.level} : ${levelInfo.pct} %`}
      />
    );
  }
  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-display font-semibold text-primary">
          Niveau {levelInfo.level} · {levelInfo.title}
        </span>
        <span className="text-muted-foreground">
          {levelInfo.next !== null
            ? `${formatSats(levelInfo.into)} / ${formatSats(levelInfo.needed)} XP`
            : `${formatSats(levelInfo.into)} XP — niveau maximum`}
        </span>
      </div>
      <Progress value={levelInfo.pct} className="h-2" />
    </div>
  );
}

/* ============ Carte de statistique ============ */

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border bg-card p-4", className)}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs text-muted-foreground">{label}</div>
        <div className="truncate font-display text-lg font-bold leading-tight">{value}</div>
        {sub && <div className="truncate text-[11px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

/* ============ Chips récompenses / preuves ============ */

export function RewardChips({ xp, sats }: { xp?: number; sats?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {typeof xp === "number" && xp > 0 && (
        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
          +{xp} XP
        </Badge>
      )}
      {typeof sats === "number" && sats > 0 && (
        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500">
          +{formatSats(sats)} sats
        </Badge>
      )}
    </div>
  );
}

export function ProofChips({ proof }: { proof: Record<string, unknown> | null }) {
  if (!proof) return null;
  const keys = [
    "txid",
    "blockHash",
    "hash",
    "channelId",
    "paymentHash",
    "psbt",
    "address",
    "outputKey",
    "fundingTxid",
  ];
  const shown = keys.filter((k) => typeof proof[k] === "string").slice(0, 2);
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((k) => (
        <code
          key={k}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
          title={`${k} : ${proof[k]}`}
        >
          {String(proof[k]).slice(0, 14)}…
        </code>
      ))}
    </div>
  );
}

/* ============ États ============ */

export function LoadingState({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {message}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Réessayer
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, sub, icon: Icon }: { title: string; sub?: string; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center">
      {Icon && <Icon className="h-8 w-8 text-muted-foreground/50" />}
      <div className="font-medium">{title}</div>
      {sub && <div className="max-w-sm text-sm text-muted-foreground">{sub}</div>}
    </div>
  );
}
