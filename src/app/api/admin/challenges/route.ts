import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { adminChallengeCreateSchema, parseJsonBody } from "@/lib/validation/schemas";

/** POST /api/admin/challenges — crée un défi pour une date donnée. */
export async function POST(req: Request) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const parsed = await parseJsonBody(req, adminChallengeCreateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const existing = await db.dailyChallenge.findUnique({ where: { date: data.date } });
  if (existing) {
    return Response.json({ error: "Un défi existe déjà pour cette date." }, { status: 409 });
  }

  const challenge = await db.dailyChallenge.create({
    data: {
      date: data.date,
      title: data.title,
      prompt: data.prompt,
      xpReward: data.xpReward,
      satsReward: data.satsReward,
    },
  });

  await logAdminAction(guard.user.id, "CHALLENGE_CREATE", `challenge:${challenge.id}`, {
    date: challenge.date,
    title: challenge.title,
  });

  return Response.json({ ok: true, challenge }, { status: 201 });
}
