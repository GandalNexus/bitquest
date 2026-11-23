import { db } from "@/lib/db";
import { authenticate, unauthorized } from "@/lib/bitquest/session";
import { levelInfo } from "@/lib/bitquest/progression";

export async function GET(req: Request) {
  const user = await authenticate(req);
  if (!user) return unauthorized();

  const [top, badgeCounts] = await Promise.all([
    db.user.findMany({
      where: { deletedAt: null },
      orderBy: [{ xp: "desc" }, { createdAt: "asc" }],
      take: 20,
    }),
    db.userBadge.groupBy({ by: ["userId"], _count: { userId: true } }),
  ]);

  const badgeMap = new Map(badgeCounts.map((b) => [b.userId, b._count.userId]));

  const entries = top.map((u, i) => ({
    rank: i + 1,
    id: u.id,
    pseudo: u.pseudo,
    isGuest: u.isGuest,
    isBot: u.isBot,
    xp: u.xp,
    sats: u.sats,
    streak: u.streak,
    badges: badgeMap.get(u.id) ?? 0,
    levelInfo: levelInfo(u.xp),
    isMe: u.id === user.id,
  }));

  return Response.json({ entries });
}
