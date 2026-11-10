"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  Coins,
  Flame,
  KeyRound,
  Lock,
  Mail,
  Map as MapIcon,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMe } from "@/lib/bitquest/hooks";
import { formatDate } from "@/lib/bitquest/client";
import {
  BadgeIcon,
  EmptyState,
  ErrorState,
  LoadingState,
  StatCard,
  XpBar,
  rarityStyles,
  trackStyles,
} from "./ui-bits";
import { PasswordChangeForm } from "./password-change-form";
import { cn } from "@/lib/utils";

const roleStyles: Record<string, string> = {
  ADMIN: "border-rose-500/40 bg-rose-500/10 text-rose-500",
  EDITOR: "border-amber-500/40 bg-amber-500/10 text-amber-500",
};

/* Anneaux de rareté (rarityStyles n'expose pas de ring) */
const RARITY_RING: Record<string, string> = {
  COMMON: "ring-2 ring-zinc-500/50",
  RARE: "ring-2 ring-amber-500/50",
  EPIC: "ring-2 ring-violet-500/50",
};

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

export function ProfileView() {
  const meQuery = useMe();

  if (meQuery.isLoading) {
    return <LoadingState label="Chargement de ton profil…" />;
  }
  if (meQuery.isError || !meQuery.data) {
    return (
      <ErrorState
        message="Impossible de charger ton profil. Vérifie ta connexion."
        onRetry={() => meQuery.refetch()}
      />
    );
  }

  const me = meQuery.data;
  const user = me.user;
  const ownedByCode = new Map(me.badges.map((b) => [b.code, b]));
  const history = [...me.questsCompleted].sort((a, b) => {
    const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return tb - ta;
  });

  return (
    <div className="space-y-6">
      {/* ===== Header profil ===== */}
      <motion.section {...fadeUp} transition={{ duration: 0.35 }}>
        <Card className="rounded-xl">
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:gap-6 sm:text-left">
              <div
                aria-hidden
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary text-3xl font-black text-primary-foreground shadow-[0_0_30px_-8px] shadow-primary/50"
              >
                {user.pseudo.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <h1 className="text-2xl font-bold tracking-tight">{user.pseudo}</h1>
                  {user.isGuest && (
                    <Badge variant="outline" className="border-zinc-500/40 bg-zinc-500/10 text-zinc-400">
                      <UserRound className="h-3 w-3" aria-hidden />
                      Invité
                    </Badge>
                  )}
                  {user.role && user.role !== "APPRENTICE" && (
                    <Badge variant="outline" className={roleStyles[user.role] ?? ""}>
                      <ShieldCheck className="h-3 w-3" aria-hidden />
                      {user.role}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Niv. {user.levelInfo.level} · {user.levelInfo.title}
                </p>
                {user.email && (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" aria-hidden />
                    {user.email}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Aventurier depuis le {formatDate(user.createdAt)}
                </p>
              </div>
            </div>
            <XpBar levelInfo={user.levelInfo} />
          </CardContent>
        </Card>
      </motion.section>

      {/* ===== Stats rapides ===== */}
      <motion.section
        {...fadeUp}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Statistiques rapides"
      >
        <StatCard icon={Star} label="XP total" value={user.xp.toLocaleString("fr-FR")} />
        <StatCard
          icon={Coins}
          label="Sats gagnés au total"
          value={`${user.satsEarnedTotal.toLocaleString("fr-FR")} sats`}
        />
        <StatCard
          icon={Flame}
          label="Série d'activité"
          value={`${user.streak} jour${user.streak > 1 ? "s" : ""}`}
        />
        <StatCard icon={MapIcon} label="Quêtes terminées" value={me.questsCompleted.length} />
      </motion.section>

      {/* ===== Badges ===== */}
      <motion.section {...fadeUp} transition={{ duration: 0.35, delay: 0.1 }}>
        <Card className="rounded-xl">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Badges</CardTitle>
                <CardDescription>
                  {me.badges.length} / {me.allBadges.length || 15} badges débloqués — collectionne-les tous.
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary">
                {me.badges.length} / {me.allBadges.length || 15}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {me.allBadges.map((badge) => {
                const owned = ownedByCode.get(badge.code);
                const rarity = rarityStyles[badge.rarity] ?? rarityStyles.COMMON;
                return (
                  <div
                    key={badge.code}
                    className={cn(
                      "relative flex gap-3 rounded-xl border bg-card p-4 transition",
                      !owned && "opacity-40 grayscale",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
                        owned && RARITY_RING[badge.rarity],
                      )}
                    >
                      <BadgeIcon icon={badge.icon} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{badge.name}</span>
                        <Badge variant="outline" className={`shrink-0 ${rarity.badge}`}>
                          {rarity.label}
                        </Badge>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{badge.description}</p>
                      {owned ? (
                        <p className="mt-1.5 text-[11px] font-medium text-emerald-500">
                          Obtenu le {formatDate(owned.earnedAt ?? null)}
                        </p>
                      ) : (
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Lock className="h-3 w-3" aria-hidden />À débloquer
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {/* ===== Sécurité du compte (seulement pour comptes enregistrés) ===== */}
      {!user.isGuest && user.email && (
        <motion.section {...fadeUp} transition={{ duration: 0.35, delay: 0.12 }}>
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" aria-hidden />
                Sécurité du compte
              </CardTitle>
              <CardDescription>
                Change ton mot de passe. Toutes les autres sessions seront déconnectées
                automatiquement.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PasswordChangeForm userId={user.id} />
            </CardContent>
          </Card>
        </motion.section>
      )}

      {/* ===== Historique des quêtes ===== */}
      <motion.section {...fadeUp} transition={{ duration: 0.35, delay: 0.15 }}>
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>Historique des quêtes</CardTitle>
            <CardDescription>
              Les quêtes que tu as menées à bien, de la plus récente à la plus ancienne.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {history.length > 0 ? (
              <ul
                className="max-h-96 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar]:w-1.5"
                aria-label="Historique des quêtes terminées"
              >
                {history.map((quest) => {
                  const style = trackStyles[quest.track];
                  return (
                    <li
                      key={quest.code}
                      className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{quest.title}</span>
                      <Badge variant="outline" className={cn("hidden shrink-0 sm:inline-flex", style?.badge)}>
                        {style?.label ?? quest.track}
                      </Badge>
                      <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                        {formatDate(quest.completedAt)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon={MapIcon}
                title="Aucune quête terminée pour l'instant"
                sub="Ta première victoire t'attend sur la carte des quêtes."
              />
            )}
          </CardContent>
        </Card>
      </motion.section>
    </div>
  );
}
