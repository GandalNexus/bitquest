import { BookOpen, FlaskConical, GraduationCap, Map, TrendingUp, Trophy, Users } from "lucide-react";
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
