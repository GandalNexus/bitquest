import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { parseJsonBody } from "@/lib/validation/schemas";
import { z } from "zod";

/**
 * POST /api/admin/chapters/[id]/quests
 * Attache une quête comme prérequis pédagogique du chapitre (LOT 23).
 *
 * Body :
 *   { questCode: string, order?: number, note?: string | null }
 *
 * Idempotent : si le lien existe déjà, met à jour `order` + `note`
 * (comportement upsert via composite PK chapterId+questId).
 */
const chapterQuestAttachSchema = z.object({
  questCode: z.string().min(1).max(64),
  order: z.number().int().nonnegative().max(999).default(1),
  note: z.string().trim().max(500).nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "EDITOR");
  if (!guard.ok) return guard.response;

  const { id: chapterId } = await params;
  const chapter = await db.chapter.findUnique({ where: { id: chapterId } });
  if (!chapter) return Response.json({ error: "Chapitre introuvable." }, { status: 404 });

  const parsed = await parseJsonBody(req, chapterQuestAttachSchema);
  if (!parsed.ok) return parsed.response;
  const { questCode, order, note } = parsed.data;

  const quest = await db.quest.findUnique({ where: { code: questCode } });
  if (!quest) return Response.json({ error: "Quête inconnue." }, { status: 404 });

  const link = await db.chapterQuest.upsert({
    where: { chapterId_questId: { chapterId, questId: quest.id } },
    update: { order, note: note ?? null },
    create: { chapterId, questId: quest.id, order, note: note ?? null },
  });

  await logAdminAction(guard.user.id, "CHAPTER_QUEST_ATTACH", `chapter:${chapterId}`, {
    questCode,
    order,
  });

  return Response.json({
    ok: true,
    link: {
      chapterId: link.chapterId,
      questId: link.questId,
      questCode: quest.code,
      questTitle: quest.title,
      order: link.order,
      note: link.note,
    },
  });
}

/**
 * DELETE /api/admin/chapters/[id]/quests?questCode=<code>
 * Détache une quête prérequise du chapitre. Idempotent (204 si pas de lien).
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "EDITOR");
  if (!guard.ok) return guard.response;

  const { id: chapterId } = await params;
  const url = new URL(req.url);
  const questCode = url.searchParams.get("questCode")?.trim() ?? "";
  if (!questCode) {
    return Response.json({ error: "questCode requis." }, { status: 400 });
  }

  const quest = await db.quest.findUnique({ where: { code: questCode } });
  if (!quest) return Response.json({ ok: true, removed: 0 });

  const res = await db.chapterQuest.deleteMany({
    where: { chapterId, questId: quest.id },
  });

  if (res.count > 0) {
    await logAdminAction(guard.user.id, "CHAPTER_QUEST_DETACH", `chapter:${chapterId}`, {
      questCode,
    });
  }

  return Response.json({ ok: true, removed: res.count });
}
