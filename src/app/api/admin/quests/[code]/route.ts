import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { adminQuestUpdateSchema, parseJsonBody } from "@/lib/validation/schemas";

/** PATCH /api/admin/quests/[code] — met à jour les métadonnées d'une quête. */
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

  const parsed = await parseJsonBody(req, adminQuestUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const quest = await db.quest.update({
    where: { code },
    data: {
      ...(data.track !== undefined && { track: data.track }),
      ...(data.order !== undefined && { order: data.order }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.subtitle !== undefined && { subtitle: data.subtitle }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.intro !== undefined && { intro: data.intro }),
      ...(data.xpReward !== undefined && { xpReward: data.xpReward }),
      ...(data.satsReward !== undefined && { satsReward: data.satsReward }),
      ...(data.requiredLevel !== undefined && { requiredLevel: data.requiredLevel }),
    },
  });

  await logAdminAction(guard.user.id, "QUEST_UPDATE", `quest:${quest.id}`, {
    code: quest.code,
    changedFields: Object.keys(data),
  });

  return Response.json({ ok: true, quest });
}

/**
 * DELETE /api/admin/quests/[code] — supprime une quête.
 *
 * Refuse si la quête est référencée par un chapitre (ChapterQuest.quest a
 * `onDelete: Restrict`). L'admin doit délier les chapitres avant. Les
 * `UserQuestProgress` et `QuizQuestion` se cascade-cleanent.
 *
 * Side-effects acceptés :
 *   - Les badges `QUEST_COMPLETE` qui ciblaient cette quête par `code`
 *     ne seront plus décernables (`evaluateBadges` renverra false).
 *   - Les `BitLabProof` / `MissionAttempt` référençant `questCode` restent
 *     en base mais pointent vers une ancre morte (trace d'audit historique).
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "EDITOR");
  if (!guard.ok) return guard.response;

  const { code } = await params;
  const existing = await db.quest.findUnique({
    where: { code },
    select: { id: true, title: true, code: true },
  });
  if (!existing) {
    return Response.json({ error: "Quête introuvable." }, { status: 404 });
  }

  const linkedChapters = await db.chapterQuest.count({ where: { questId: existing.id } });
  if (linkedChapters > 0) {
    return Response.json(
      {
        error: `Impossible de supprimer : cette quête est liée à ${linkedChapters} chapitre${linkedChapters > 1 ? "s" : ""}. Détache-la d'abord.`,
      },
      { status: 409 },
    );
  }

  await db.quest.delete({ where: { id: existing.id } });

  await logAdminAction(guard.user.id, "QUEST_DELETE", `quest:${existing.id}`, {
    code: existing.code,
    title: existing.title,
  });

  return Response.json({ ok: true });
}
