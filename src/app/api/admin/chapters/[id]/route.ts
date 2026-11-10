import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { adminChapterUpdateSchema, parseJsonBody } from "@/lib/validation/schemas";

/** PATCH /api/admin/chapters/[id] — met à jour un chapitre. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const existing = await db.chapter.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Chapitre introuvable." }, { status: 404 });
  }

  const parsed = await parseJsonBody(req, adminChapterUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  if (data.slug && data.slug !== existing.slug) {
    const slugTaken = await db.chapter.findUnique({
      where: { courseId_slug: { courseId: existing.courseId, slug: data.slug } },
    });
    if (slugTaken) {
      return Response.json(
        { error: "Ce slug est déjà utilisé dans ce cours." },
        { status: 409 },
      );
    }
  }

  const chapter = await db.chapter.update({
    where: { id },
    data: {
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.summary !== undefined && { summary: data.summary }),
      ...(data.order !== undefined && { order: data.order }),
    },
  });
  return Response.json({ ok: true, chapter });
}

/** DELETE /api/admin/chapters/[id] — refuse si des leçons sont encore liées. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const lessonsCount = await db.lesson.count({ where: { chapterId: id } });
  if (lessonsCount > 0) {
    return Response.json(
      {
        error: `Impossible de supprimer : ${lessonsCount} leçon${lessonsCount > 1 ? "s" : ""} encore liée${lessonsCount > 1 ? "s" : ""}. Supprime-les d'abord.`,
      },
      { status: 409 },
    );
  }

  try {
    await db.chapter.delete({ where: { id } });
  } catch {
    return Response.json({ error: "Chapitre introuvable." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
