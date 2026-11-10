import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { adminBadgeUpdateSchema, parseJsonBody } from "@/lib/validation/schemas";

/** PATCH /api/admin/badges/[id] — met à jour un badge (ADMIN). Code immuable. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const existing = await db.badge.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Badge introuvable." }, { status: 404 });
  }

  const parsed = await parseJsonBody(req, adminBadgeUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const badge = await db.badge.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.rarity !== undefined && { rarity: data.rarity }),
      ...(data.conditionType !== undefined && { conditionType: data.conditionType }),
      ...(data.conditionValue !== undefined && {
        conditionValue: JSON.stringify(data.conditionValue),
      }),
    },
  });

  await logAdminAction(guard.user.id, "BADGE_UPDATE", `badge:${badge.id}`, {
    code: badge.code,
    changedFields: Object.keys(data),
  });

  return Response.json({ ok: true, badge });
}

/**
 * DELETE /api/admin/badges/[id]
 *
 * Supprime un badge. Si des utilisateurs l'ont déjà obtenu, le schéma Prisma
 * cascade sur UserBadge (les lignes sont effacées). On refuse par défaut et
 * on exige un paramètre `?force=true` pour prévenir une perte d'historique
 * accidentelle côté apprenants.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const existing = await db.badge.findUnique({
    where: { id },
    select: { code: true, name: true },
  });
  if (!existing) {
    return Response.json({ error: "Badge introuvable." }, { status: 404 });
  }

  const earnedCount = await db.userBadge.count({ where: { badgeId: id } });
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "true";

  if (earnedCount > 0 && !force) {
    return Response.json(
      {
        error: `Ce badge a été obtenu par ${earnedCount} utilisateur${earnedCount > 1 ? "s" : ""}. Renvoie la requête avec ?force=true pour confirmer la suppression en cascade.`,
        earnedCount,
      },
      { status: 409 },
    );
  }

  await db.badge.delete({ where: { id } });

  await logAdminAction(guard.user.id, "BADGE_DELETE", `badge:${id}`, {
    code: existing.code,
    name: existing.name,
    earnedCount,
    forced: force,
  });

  return Response.json({ ok: true, earnedCount });
}
