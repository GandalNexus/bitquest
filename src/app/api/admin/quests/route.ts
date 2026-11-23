import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { adminQuestCreateSchema, parseJsonBody } from "@/lib/validation/schemas";

/**
 * POST /api/admin/quests — crée une quête (coquille éditable).
 *
 * - Guard EDITOR+ via `requireRoleAndCsrf` (même pattern que les autres
 *   routes mutantes).
 * - `code` doit être unique en base (409 sinon). Normalisé en kebab-case
 *   par le schéma Zod (`toLowerCase()`).
 * - `theorySections` initialisé à `[]` et `missionConfig` à une enveloppe
 *   vide `{ brief: "", hint: "" }` — à remplir ensuite via les builders
 *   dédiés (`/admin/quests/[code]/theory|quiz|mission`).
 */
export async function POST(req: Request) {
  const guard = await requireRoleAndCsrf(req, "EDITOR");
  if (!guard.ok) return guard.response;

  const parsed = await parseJsonBody(req, adminQuestCreateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const existing = await db.quest.findUnique({ where: { code: data.code } });
  if (existing) {
    return Response.json({ error: "Une quête utilise déjà ce code." }, { status: 409 });
  }

  const quest = await db.quest.create({
    data: {
      code: data.code,
      track: data.track,
      order: data.order,
      title: data.title,
      subtitle: data.subtitle,
      description: data.description,
      intro: data.intro,
      theorySections: "[]",
      xpReward: data.xpReward,
      satsReward: data.satsReward,
      requiredLevel: data.requiredLevel,
      missionType: data.missionType,
      missionConfig: JSON.stringify({ brief: "", hint: "" }),
      missionKind: data.missionKind,
    },
  });

  await logAdminAction(guard.user.id, "QUEST_CREATE", `quest:${quest.id}`, {
    code: quest.code,
    track: quest.track,
    missionType: quest.missionType,
    missionKind: quest.missionKind,
  });

  return Response.json({ ok: true, quest }, { status: 201 });
}
