import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { adminCourseUpdateSchema, parseJsonBody } from "@/lib/validation/schemas";

/** PATCH /api/admin/courses/[id] — met à jour un cours (ADMIN). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const existing = await db.course.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Cours introuvable." }, { status: 404 });
  }

  const parsed = await parseJsonBody(req, adminCourseUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  // Si on change le slug, vérifier l'unicité.
  if (data.slug && data.slug !== existing.slug) {
    const slugTaken = await db.course.findUnique({ where: { slug: data.slug } });
    if (slugTaken) {
      return Response.json({ error: "Ce slug est déjà utilisé." }, { status: 409 });
    }
  }

  const course = await db.course.update({
    where: { id },
    data: {
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.subtitle !== undefined && { subtitle: data.subtitle }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.coverIcon !== undefined && { coverIcon: data.coverIcon }),
      ...(data.order !== undefined && { order: data.order }),
      ...(data.publishedAt !== undefined && {
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      }),
    },
  });
  return Response.json({ ok: true, course });
}

/** DELETE /api/admin/courses/[id] — supprime un cours (ADMIN). Refuse si chapitres associés. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const chaptersCount = await db.chapter.count({ where: { courseId: id } });
  if (chaptersCount > 0) {
    return Response.json(
      {
        error: `Impossible de supprimer : ${chaptersCount} chapitre${chaptersCount > 1 ? "s" : ""} encore lié${chaptersCount > 1 ? "s" : ""} à ce cours. Supprime-les d'abord.`,
      },
      { status: 409 },
    );
  }

  try {
    await db.course.delete({ where: { id } });
  } catch {
    return Response.json({ error: "Cours introuvable." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
