import {
  Activity,
  BookOpen,
  FlaskConical,
  GraduationCap,
  Map,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface StatRow {
  label: string;
  value: number;
  icon: LucideIcon;
  hint?: string;
}

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const last24h = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
  const [
    totalUsers,
    guestUsers,
    botUsers,
    admins,
    editors,
    totalQuests,
    completedQuestProgress,
    totalBadges,
    userBadges,
    totalCourses,
    totalChapters,
    totalLessons,
    totalLessonProgress,
    bitlabAttempts24h,
    bitlabAccepted24h,
  ] = await Promise.all([
    db.user.count({ where: { deletedAt: null } }),
    db.user.count({ where: { deletedAt: null, isGuest: true } }),
    db.user.count({ where: { deletedAt: null, isBot: true } }),
    db.user.count({ where: { deletedAt: null, role: "ADMIN" } }),
    db.user.count({ where: { deletedAt: null, role: "EDITOR" } }),
    db.quest.count(),
    db.userQuestProgress.count({ where: { status: "COMPLETED" } }),
    db.badge.count(),
    db.userBadge.count(),
    db.course.count({ where: { publishedAt: { not: null } } }),
    db.chapter.count(),
    db.lesson.count({ where: { publishedAt: { not: null } } }),
    db.lessonProgress.count(),
    db.bitLabProofAttempt.count({ where: { createdAt: { gte: last24h } } }),
    db.bitLabProofAttempt.count({
      where: { createdAt: { gte: last24h }, outcome: "ACCEPTED" },
    }),
  ]);
  const bitlabAcceptedPct =
    bitlabAttempts24h > 0 ? Math.round((bitlabAccepted24h / bitlabAttempts24h) * 100) : 0;

  // ============ Santé opérationnelle 24h (alerting) ============
  // BitLab proofs : top outcomes non-ACCEPTED pour détecter les régressions
  // côté verif. Lightning rewards : PAID vs FAILED + top failure codes.
  const [bitlabOutcomes, lightningRewards24h, lightningFailuresTop] = await Promise.all([
    db.bitLabProofAttempt.groupBy({
      by: ["outcome"],
      where: { createdAt: { gte: last24h }, outcome: { not: "ACCEPTED" } },
      _count: { _all: true },
      orderBy: { _count: { outcome: "desc" } },
      take: 5,
    }),
    db.lightningReward.groupBy({
      by: ["status"],
      where: { createdAt: { gte: last24h } },
      _count: { _all: true },
    }),
    db.lightningReward.groupBy({
      by: ["failureReason"],
      where: {
        createdAt: { gte: last24h },
        status: "FAILED",
        failureReason: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { failureReason: "desc" } },
      take: 3,
    }),
  ]);
  const rewardsPaid =
    lightningRewards24h.find((r) => r.status === "PAID")?._count._all ?? 0;
  const rewardsFailed =
    lightningRewards24h.find((r) => r.status === "FAILED")?._count._all ?? 0;
  const rewardsPending =
    lightningRewards24h.find((r) => r.status === "PENDING")?._count._all ?? 0;
  const rewardsTotal = rewardsPaid + rewardsFailed + rewardsPending;
  const rewardsPaidPct =
    rewardsTotal > 0 ? Math.round((rewardsPaid / rewardsTotal) * 100) : 0;

  // Analytics pédagogiques : complétion et friction par quête. Groupement
  // côté DB (count per questId, partitionné par status) pour éviter de
  // ramener toutes les lignes UserQuestProgress en mémoire.
  const [quests, progressByQuest] = await Promise.all([
    db.quest.findMany({
      orderBy: [{ track: "asc" }, { order: "asc" }],
      select: { id: true, code: true, title: true, track: true },
    }),
    db.userQuestProgress.groupBy({
      by: ["questId", "status"],
      _count: { _all: true },
      _avg: { quizAttempts: true, missionAttempts: true },
    }),
  ]);

  type QuestStats = {
    started: number;
    completed: number;
    avgQuizAttempts: number;
    avgMissionAttempts: number;
  };
  const perQuest: Record<string, QuestStats> = {};
  for (const row of progressByQuest) {
    const prev = perQuest[row.questId] ?? {
      started: 0,
      completed: 0,
      avgQuizAttempts: 0,
      avgMissionAttempts: 0,
    };
    prev.started += row._count._all;
    if (row.status === "COMPLETED") prev.completed = row._count._all;
    // Moyenne pondérée des moyennes par groupe (approx — acceptable pour dashboard).
    if (row._avg.quizAttempts) prev.avgQuizAttempts = row._avg.quizAttempts;
    if (row._avg.missionAttempts) prev.avgMissionAttempts = row._avg.missionAttempts;
    perQuest[row.questId] = prev;
  }

  const questRows = quests
    .map((q) => {
      const p = perQuest[q.id] ?? {
        started: 0,
        completed: 0,
        avgQuizAttempts: 0,
        avgMissionAttempts: 0,
      };
      const completionPct = p.started > 0 ? Math.round((p.completed / p.started) * 100) : 0;
      return { ...q, ...p, completionPct };
    })
    .filter((r) => r.started > 0)
    .sort((a, b) => a.completionPct - b.completionPct);

  const stats: StatRow[] = [
    {
      label: "Utilisateurs",
      value: totalUsers,
      icon: Users,
      hint: `${guestUsers} invités · ${botUsers} bots · ${admins} admin${admins > 1 ? "s" : ""} · ${editors} éditeur${editors > 1 ? "s" : ""}`,
    },
    {
      label: "Quêtes",
      value: totalQuests,
      icon: Map,
      hint: `${completedQuestProgress} complétion${completedQuestProgress > 1 ? "s" : ""} au total`,
    },
    {
      label: "Cours publiés",
      value: totalCourses,
      icon: GraduationCap,
      hint: `${totalChapters} chapitres · ${totalLessons} leçons publiées`,
    },
    {
      label: "Leçons lues",
      value: totalLessonProgress,
      icon: BookOpen,
      hint: "Toutes progressions confondues",
    },
    {
      label: "Badges configurés",
      value: totalBadges,
      icon: Trophy,
      hint: `${userBadges} débloqués par les utilisateurs`,
    },
    {
      label: "BitLab preuves (24h)",
      value: bitlabAttempts24h,
      icon: FlaskConical,
      hint:
        bitlabAttempts24h > 0
          ? `${bitlabAccepted24h} acceptées · ${bitlabAcceptedPct}% de succès`
          : "Aucune tentative sur les dernières 24h",
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Vue d&apos;ensemble</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          État courant de la plateforme BitQuest. Les CRUD complets arrivent dans les sprints
          Phase 2 suivants (cours, quêtes, utilisateurs, badges).
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" aria-hidden />
              Santé BitLab preuves · 24h
            </CardTitle>
            <CardDescription>
              {bitlabAttempts24h} tentatives, {bitlabAcceptedPct}% ACCEPTED.
              {bitlabAttempts24h > 0 && bitlabAcceptedPct < 50 && (
                <span className="ml-1 font-medium text-destructive">
                  ⚠ Taux de succès faible — investiguer.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bitlabOutcomes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune tentative refusée sur 24h. Rien à signaler.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {bitlabOutcomes.map((o) => (
                  <li key={o.outcome} className="flex items-center justify-between text-sm">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {o.outcome}
                    </code>
                    <span className="tabular-nums text-muted-foreground">
                      {o._count._all}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-amber-500" aria-hidden />
              Lightning rewards · 24h
            </CardTitle>
            <CardDescription>
              {rewardsTotal === 0
                ? "Aucune tentative sur 24h."
                : `${rewardsTotal} tentative${rewardsTotal > 1 ? "s" : ""} · ${rewardsPaidPct}% PAID`}
              {rewardsTotal > 0 && rewardsFailed > rewardsPaid && (
                <span className="ml-1 font-medium text-destructive">
                  ⚠ Plus d&apos;échecs que de paiements — vérifier LND + plafonds.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rewardsTotal === 0 ? (
              <p className="text-sm text-muted-foreground">
                Le programme n&apos;a déclenché aucun flux — flag OFF ou
                queue vide.
              </p>
            ) : (
              <>
                <div className="mb-3 flex gap-2 text-xs">
                  <Badge
                    variant="outline"
                    className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                  >
                    PAID {rewardsPaid}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-destructive/40 bg-destructive/10 text-destructive"
                  >
                    FAILED {rewardsFailed}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 bg-amber-500/10 text-amber-600"
                  >
                    PENDING {rewardsPending}
                  </Badge>
                </div>
                {lightningFailuresTop.length > 0 && (
                  <>
                    <div className="mb-1.5 text-xs text-muted-foreground">
                      Top raisons d&apos;échec :
                    </div>
                    <ul className="space-y-1">
                      {lightningFailuresTop.map((f) => (
                        <li
                          key={f.failureReason ?? "unknown"}
                          className="flex items-center justify-between text-sm"
                        >
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                            {f.failureReason ?? "—"}
                          </code>
                          <span className="tabular-nums text-muted-foreground">
                            {f._count._all}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
              Analytics par quête
            </CardTitle>
            <CardDescription>
              Taux de complétion et friction (tentatives moyennes) par quête, triés du plus
              difficile au plus simple. Seules les quêtes avec au moins une tentative
              apparaissent.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {questRows.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Aucune donnée de progression pour l&apos;instant.
              </p>
            ) : (
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Quête</th>
                    <th className="px-4 py-2 font-medium">Track</th>
                    <th className="px-4 py-2 font-medium" title="Nombre d'utilisateurs ayant au moins ouvert la quête">
                      Démarrées
                    </th>
                    <th className="px-4 py-2 font-medium" title="Nombre d'utilisateurs ayant atteint le statut COMPLETED">
                      Terminées
                    </th>
                    <th className="px-4 py-2 font-medium">Complétion</th>
                    <th className="px-4 py-2 font-medium" title="Tentatives moyennes au quiz avant succès">
                      Quiz avg
                    </th>
                    <th className="px-4 py-2 font-medium" title="Tentatives moyennes à la mission avant succès">
                      Mission avg
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {questRows.map((q) => (
                    <tr key={q.id} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">
                        {q.title}
                        <code className="ml-1 rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {q.code}
                        </code>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{q.track}</td>
                      <td className="px-4 py-2 tabular-nums text-muted-foreground">{q.started}</td>
                      <td className="px-4 py-2 tabular-nums text-muted-foreground">{q.completed}</td>
                      <td className="px-4 py-2">
                        <Badge
                          variant="outline"
                          className={
                            q.completionPct >= 70
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                              : q.completionPct >= 40
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
                                : "border-destructive/40 bg-destructive/10 text-destructive"
                          }
                        >
                          {q.completionPct}%
                        </Badge>
                      </td>
                      <td className="px-4 py-2 tabular-nums text-xs text-muted-foreground">
                        {q.avgQuizAttempts > 0 ? q.avgQuizAttempts.toFixed(1) : "—"}
                      </td>
                      <td className="px-4 py-2 tabular-nums text-xs text-muted-foreground">
                        {q.avgMissionAttempts > 0 ? q.avgMissionAttempts.toFixed(1) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatCard({ stat }: { stat: StatRow }) {
  const Icon = stat.icon;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">
          {stat.label}
        </CardDescription>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </CardHeader>
      <CardContent>
        <div className="font-display text-3xl font-bold">{stat.value.toLocaleString("fr-FR")}</div>
        {stat.hint && <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>}
      </CardContent>
    </Card>
  );
}
