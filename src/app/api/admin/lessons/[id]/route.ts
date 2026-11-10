import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { adminLessonUpdateSchema, parseJsonBody } from "@/lib/validation/schemas";

/** PATCH /api/admin/lessons/[id] — met à jour une leçon. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const existing = await db.lesson.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Leçon introuvable." }, { status: 404 });
  }

  const parsed = await parseJsonBody(req, adminLessonUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  if (data.slug && data.slug !== existing.slug) {
    const slugTaken = await db.lesson.findUnique({
      where: { chapterId_slug: { chapterId: existing.chapterId, slug: data.slug } },
    });
    if (slugTaken) {
      return Response.json(
        { error: "Ce slug est déjà utilisé dans ce chapitre." },
        { status: 409 },
      );
    }
  }

  const lesson = await db.lesson.update({
    where: { id },
    data: {
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.summary !== undefined && { summary: data.summary }),
      ...(data.content !== undefined && { content: data.content }),
      ...(data.estimatedMinutes !== undefined && { estimatedMinutes: data.estimatedMinutes }),
      ...(data.order !== undefined && { order: data.order }),
      ...(data.publishedAt !== undefined && {
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      }),
    },
  });
  await logAdminAction(guard.user.id, "LESSON_UPDATE", `lesson:${lesson.id}`, {
    changedFields: Object.keys(data),
  });
  return Response.json({ ok: true, lesson });
}

/** DELETE /api/admin/lessons/[id] — supprime une leçon (LessonProgress cascade par schéma). */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const existingForLog = await db.lesson.findUnique({
    where: { id },
    select: { slug: true, title: true, chapterId: true },
  });
  try {
    await db.lesson.delete({ where: { id } });
  } catch {
    return Response.json({ error: "Leçon introuvable." }, { status: 404 });
  }
  await logAdminAction(guard.user.id, "LESSON_DELETE", `lesson:${id}`, {
    slug: existingForLog?.slug,
    title: existingForLog?.title,
    chapterId: existingForLog?.chapterId,
  });
  return Response.json({ ok: true });
}
