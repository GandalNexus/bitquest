import { db } from "@/lib/db";
import { authenticate, unauthorized } from "@/lib/bitquest/session";
import { publicUser } from "@/lib/bitquest/progression";

export async function GET(req: Request) {
  const user = await authenticate(req);
  if (!user) return unauthorized();

  const [badges, events, completed, allBadges] = await Promise.all([
    db.userBadge.findMany({
      where: { userId: user.id },
      include: { badge: true },
      orderBy: { earnedAt: "desc" },
    }),
    db.userEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    db.userQuestProgress.findMany({
      where: { userId: user.id, status: "COMPLETED" },
      include: { quest: { select: { title: true, code: true, track: true } } },
      orderBy: { completedAt: "desc" },
    }),
    db.badge.findMany({ orderBy: [{ rarity: "asc" }, { name: "asc" }] }),
  ]);

  return Response.json({
    user: publicUser(user),
    badges: badges.map((b) => ({
      code: b.badge.code,
      name: b.badge.name,
      description: b.badge.description,
      icon: b.badge.icon,
      rarity: b.badge.rarity,
      earnedAt: b.earnedAt.toISOString(),
    })),
    events: events.map((e) => ({
      type: e.type,
      payload: JSON.parse(e.payload || "{}"),
      createdAt: e.createdAt.toISOString(),
    })),
    questsCompleted: completed.map((c) => ({
      code: c.quest.code,
      title: c.quest.title,
      track: c.quest.track,
      completedAt: c.completedAt?.toISOString() ?? null,
    })),
    allBadges: allBadges.map((b) => ({
      code: b.code,
      name: b.name,
      description: b.description,
      icon: b.icon,
      rarity: b.rarity,
    })),
  });
}
