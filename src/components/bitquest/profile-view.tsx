"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Coins,
  Flame,
  KeyRound,
  Loader2,
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
import { api, formatDate } from "@/lib/bitquest/client";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/i18n/locale-provider";
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
import { AccountDeleteForm } from "./account-delete-form";
import { PasswordChangeForm } from "./password-change-form";
import { cn } from "@/lib/utils";

const roleStyles: Record<string, string> = {
  ADMIN: "border-rose-500/40 bg-rose-500/10 text-rose-500",
  EDITOR: "border-amber-500/40 bg-amber-500/10 text-amber-500",
};

/**
 * Sous-composant : propose de (ré)envoyer l'email de vérification.
 * En dev, l'URL est retournée directement et affichée pour éviter SMTP.
 */
function EmailVerifyCta() {
  const { toast } = useToast();
  const t = useT();
  const [pending, setPending] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);

  const onSend = async () => {
    setPending(true);
    try {
      const res = await api.sendEmailVerification();
      if (res.alreadyVerified) {
        toast({ title: t("profile.email.already") });
      } else {
        setDevUrl(res.devUrl ?? null);
        toast({
          title: t("profile.email.sent.title"),
          description: res.devUrl
            ? t("profile.email.sent.dev")
            : t("profile.email.sent.prod"),
        });
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: t("profile.email.error.title"),
        description: e instanceof Error ? e.message : t("common.unknownError"),
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <span className="ml-1 inline-flex flex-wrap items-center gap-1 text-[11px]">
      <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-500">
        {t("profile.email.notVerified")}
      </Badge>
      <button
        type="button"
        onClick={onSend}
        disabled={pending}
        className="text-primary underline-offset-2 hover:underline disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> {t("profile.email.sending")}
          </>
        ) : (
          t("profile.email.resend")
        )}
      </button>
      {devUrl && (
        <code className="block w-full truncate rounded bg-muted px-1 py-0.5 font-mono text-[10px]" title={devUrl}>
          {devUrl}
        </code>
      )}
    </span>
  );
}

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
  const t = useT();
  const meQuery = useMe();

  if (meQuery.isLoading) {
    return <LoadingState label={t("profile.loading")} />;
  }
  if (meQuery.isError || !meQuery.data) {
    return (
      <ErrorState
        message={t("profile.error")}
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

  const streakLabel =
    user.streak === 1
      ? t("profile.stat.streak.days.one", { count: user.streak })
      : t("profile.stat.streak.days.many", { count: user.streak });

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
                      {t("profile.guest")}
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
                  {t("profile.level", { level: user.levelInfo.level, title: user.levelInfo.title })}
                </p>
                {user.email && (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" aria-hidden />
                    {user.email}
                    {user.emailVerified ? (
                      <Badge
                        variant="outline"
                        className="ml-1 gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                      >
                        <CheckCircle2 className="h-3 w-3" aria-hidden />
                        {t("profile.email.verified")}
                      </Badge>
                    ) : (
                      <EmailVerifyCta />
                    )}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("profile.member.since", { date: formatDate(user.createdAt) })}
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
        aria-label={t("profile.stats.aria")}
      >
        <StatCard icon={Star} label={t("profile.stat.xp")} value={user.xp.toLocaleString("fr-FR")} />
        <StatCard
          icon={Coins}
          label={t("profile.stat.sats")}
          value={`${user.satsEarnedTotal.toLocaleString("fr-FR")} sats`}
        />
        <StatCard icon={Flame} label={t("profile.stat.streak")} value={streakLabel} />
        <StatCard icon={MapIcon} label={t("profile.stat.quests")} value={me.questsCompleted.length} />
      </motion.section>

      {/* ===== Badges ===== */}
      <motion.section {...fadeUp} transition={{ duration: 0.35, delay: 0.1 }}>
        <Card className="rounded-xl">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>{t("profile.badges.title")}</CardTitle>
                <CardDescription>
                  {t("profile.badges.description", {
                    owned: me.badges.length,
                    total: me.allBadges.length || 15,
                  })}
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
                          {t("profile.badges.owned.earned", {
                            date: formatDate(owned.earnedAt ?? null),
                          })}
                        </p>
                      ) : (
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Lock className="h-3 w-3" aria-hidden />
                          {t("profile.badges.locked")}
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
                {t("profile.security.title")}
              </CardTitle>
              <CardDescription>{t("profile.security.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <PasswordChangeForm userId={user.id} />
            </CardContent>
          </Card>
        </motion.section>
      )}

      {/* ===== Zone de suppression RGPD ===== */}
      <motion.section {...fadeUp} transition={{ duration: 0.35, delay: 0.14 }}>
        <Card className="rounded-xl border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive">{t("profile.delete.title")}</CardTitle>
            <CardDescription>{t("profile.delete.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <AccountDeleteForm isGuest={user.isGuest} />
          </CardContent>
        </Card>
      </motion.section>


      {/* ===== Historique des quêtes ===== */}
      <motion.section {...fadeUp} transition={{ duration: 0.35, delay: 0.15 }}>
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle>{t("profile.history.title")}</CardTitle>
            <CardDescription>{t("profile.history.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length > 0 ? (
              <ul
                className="max-h-96 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar]:w-1.5"
                aria-label={t("profile.history.aria")}
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
                title={t("profile.history.empty.title")}
                sub={t("profile.history.empty.sub")}
              />
            )}
          </CardContent>
        </Card>
      </motion.section>
    </div>
  );
}
