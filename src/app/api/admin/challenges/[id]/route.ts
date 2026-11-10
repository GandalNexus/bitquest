import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { adminChallengeUpdateSchema, parseJsonBody } from "@/lib/validation/schemas";

/** PATCH /api/admin/challenges/[id] — met à jour un défi. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const existing = await db.dailyChallenge.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Défi introuvable." }, { status: 404 });
  }

  const parsed = await parseJsonBody(req, adminChallengeUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  if (data.date && data.date !== existing.date) {
    const conflict = await db.dailyChallenge.findUnique({ where: { date: data.date } });
    if (conflict) {
      return Response.json(
        { error: "Un défi existe déjà pour cette date." },
        { status: 409 },
      );
    }
  }

  const challenge = await db.dailyChallenge.update({
    where: { id },
    data: {
      ...(data.date !== undefined && { date: data.date }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.prompt !== undefined && { prompt: data.prompt }),
      ...(data.xpReward !== undefined && { xpReward: data.xpReward }),
      ...(data.satsReward !== undefined && { satsReward: data.satsReward }),
    },
  });

  await logAdminAction(guard.user.id, "CHALLENGE_UPDATE", `challenge:${challenge.id}`, {
    date: challenge.date,
    changedFields: Object.keys(data),
  });

  return Response.json({ ok: true, challenge });
}

/**
 * DELETE /api/admin/challenges/[id]
 *
 * Refuse par défaut si des utilisateurs ont déjà validé ce défi. `?force=true`
 * confirme la suppression en cascade (schéma onDelete: Cascade sur
 * DailyChallengeCompletion).
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const existing = await db.dailyChallenge.findUnique({
    where: { id },
    select: { date: true, title: true },
  });
  if (!existing) {
    return Response.json({ error: "Défi introuvable." }, { status: 404 });
  }

  const completionsCount = await db.dailyChallengeCompletion.count({
    where: { challengeId: id },
  });
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "true";

  if (completionsCount > 0 && !force) {
    return Response.json(
      {
        error: `Ce défi a été validé par ${completionsCount} utilisateur${completionsCount > 1 ? "s" : ""}. Renvoie la requête avec ?force=true pour confirmer la suppression en cascade.`,
        completionsCount,
      },
      { status: 409 },
    );
  }

  await db.dailyChallenge.delete({ where: { id } });

  await logAdminAction(guard.user.id, "CHALLENGE_DELETE", `challenge:${id}`, {
    date: existing.date,
    title: existing.title,
    completionsCount,
    forced: force,
  });

  return Response.json({ ok: true, completionsCount });
}
