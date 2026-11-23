import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { adminBadgeCreateSchema, parseJsonBody } from "@/lib/validation/schemas";

/** POST /api/admin/badges — crée un badge (ADMIN). */
export async function POST(req: Request) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const parsed = await parseJsonBody(req, adminBadgeCreateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const existing = await db.badge.findUnique({ where: { code: data.code } });
  if (existing) {
    return Response.json({ error: "Ce code est déjà utilisé." }, { status: 409 });
  }

  const badge = await db.badge.create({
    data: {
      code: data.code,
      name: data.name,
      description: data.description,
      icon: data.icon,
      rarity: data.rarity,
      conditionType: data.conditionType,
      conditionValue: JSON.stringify(data.conditionValue),
    },
  });

  await logAdminAction(guard.user.id, "BADGE_CREATE", `badge:${badge.id}`, {
    code: badge.code,
    name: badge.name,
    rarity: badge.rarity,
    conditionType: badge.conditionType,
  });

  return Response.json({ ok: true, badge }, { status: 201 });
}
