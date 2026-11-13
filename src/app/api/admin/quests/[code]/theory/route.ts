import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { adminQuestTheorySchema, parseJsonBody } from "@/lib/validation/schemas";

/**
 * PATCH /api/admin/quests/[code]/theory — remplace l'intégralité des sections
 * théoriques d'une quête. Le payload est un tableau ordonné.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "EDITOR");
  if (!guard.ok) return guard.response;

  const { code } = await params;
  const existing = await db.quest.findUnique({ where: { code } });
  if (!existing) {
    return Response.json({ error: "Quête introuvable." }, { status: 404 });
  }

  const parsed = await parseJsonBody(req, adminQuestTheorySchema);
  if (!parsed.ok) return parsed.response;
  const sections = parsed.data.sections;

  const quest = await db.quest.update({
    where: { code },
    data: { theorySections: JSON.stringify(sections) },
  });

  await logAdminAction(guard.user.id, "QUEST_THEORY_UPDATE", `quest:${quest.id}`, {
    code: quest.code,
    sectionCount: sections.length,
  });

  return Response.json({ ok: true, sectionCount: sections.length });
}
