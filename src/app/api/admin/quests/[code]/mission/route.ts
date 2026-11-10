import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { adminQuestMissionSchema, parseJsonBody } from "@/lib/validation/schemas";

/**
 * PATCH /api/admin/quests/[code]/mission — met à jour le type de mission
 * et sa configuration.
 *
 * Le format en base est une seule chaîne JSON `missionConfig` qui fusionne
 * la config type-spécifique avec `brief` et `hint` (schéma hérité du seed).
 * Les builders côté UI pourront arriver par type sans changer cette forme.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const { code } = await params;
  const quest = await db.quest.findUnique({ where: { code } });
  if (!quest) {
    return Response.json({ error: "Quête introuvable." }, { status: 404 });
  }

  const parsed = await parseJsonBody(req, adminQuestMissionSchema);
  if (!parsed.ok) return parsed.response;
  const { missionType, brief, hint, config } = parsed.data;

  const previousType = quest.missionType;
  const mergedConfig = { ...config, brief, hint };

  const updated = await db.quest.update({
    where: { code },
    data: {
      missionType,
      missionConfig: JSON.stringify(mergedConfig),
    },
  });

  await logAdminAction(guard.user.id, "QUEST_MISSION_UPDATE", `quest:${updated.id}`, {
    code: updated.code,
    previousType,
    newType: missionType,
    configKeys: Object.keys(mergedConfig).sort(),
  });

  return Response.json({ ok: true, missionType: updated.missionType });
}
