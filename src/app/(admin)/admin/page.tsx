import { BookOpen, GraduationCap, Map, Sparkles, Trophy, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface StatRow {
  label: string;
  value: number;
  icon: LucideIcon;
  hint?: string;
}

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
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
  ]);

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
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              Prochaines étapes
            </CardTitle>
            <CardDescription>Les sous-sections sont encore en construction.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">Utilisateurs</strong> — liste, filtres, changement
                de rôle, audit log (Phase 2.7).
              </li>
              <li>
                <strong className="text-foreground">Cours & leçons</strong> — CRUD + éditeur MDX
                (Phase 2.4 → 2.5).
              </li>
              <li>
                <strong className="text-foreground">Quêtes / Quiz / Badges</strong> — builders dédiés
                (Phase 2.6).
              </li>
            </ul>
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
