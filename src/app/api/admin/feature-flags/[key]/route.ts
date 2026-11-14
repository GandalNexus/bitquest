import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { parseJsonBody } from "@/lib/validation/schemas";
import { z } from "zod";

/**
 * PATCH /api/admin/feature-flags/[key] — toggle un FeatureFlag.
 *
 * ADMIN only (pas EDITOR) : les flags protègent des zones à impact
 * produit majeur (lightning.rewards = paiements réels). Pas de CSRF
 * bypass.
 *
 * Body :
 *   { enabled?: boolean, userIds?: string[] }
 *
 * - `enabled` : flag global (si true → actif pour tous sauf si userIds
 *   sert de canary explicit — comportement laissé à isFeatureEnabled).
 * - `userIds` : liste JSON d'utilisateurs explicitement activés
 *   (canary) — max 100 user IDs.
 */
const flagUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  userIds: z.array(z.string().min(1).max(64)).max(100).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const { key } = await params;
  if (!/^[a-z0-9._-]{3,64}$/.test(key)) {
    return Response.json({ error: "Clé invalide." }, { status: 400 });
  }

  const existing = await db.featureFlag.findUnique({ where: { key } });
  if (!existing) return Response.json({ error: "Flag introuvable." }, { status: 404 });

  const parsed = await parseJsonBody(req, flagUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const updated = await db.featureFlag.update({
    where: { key },
    data: {
      ...(data.enabled !== undefined && { enabled: data.enabled }),
      ...(data.userIds !== undefined && { userIds: JSON.stringify(data.userIds) }),
    },
  });

  await logAdminAction(
    guard.user.id,
    "FEATURE_FLAG_UPDATE",
    `flag:${key}`,
    {
      enabled: data.enabled,
      userIdsCount: data.userIds?.length,
    },
  );

  return Response.json({
    ok: true,
    flag: {
      key: updated.key,
      enabled: updated.enabled,
      userIds: JSON.parse(updated.userIds) as string[],
      updatedAt: updated.updatedAt,
    },
  });
}
