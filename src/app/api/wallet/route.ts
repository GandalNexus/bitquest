import { db } from "@/lib/db";
import { authenticate, unauthorized } from "@/lib/bitquest/session";
import { SATS_DAILY_CAP } from "@/lib/bitquest/progression";

export async function GET(req: Request) {
  const user = await authenticate(req);
  if (!user) return unauthorized();

  const [transactions, totals] = await Promise.all([
    db.walletTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.walletTransaction.aggregate({
      where: { userId: user.id },
      _sum: { amount: true },
    }),
  ]);

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const today = await db.walletTransaction.aggregate({
    where: { userId: user.id, createdAt: { gte: startOfDay } },
    _sum: { amount: true },
  });

  return Response.json({
    balance: user.sats,
    totalEarned: totals._sum.amount ?? 0,
    dailyUsed: today._sum.amount ?? 0,
    dailyCap: SATS_DAILY_CAP,
    transactions: transactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      type: t.type,
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    })),
  });
}
