import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { adminLessonCreateSchema, parseJsonBody } from "@/lib/validation/schemas";

/** POST /api/admin/chapters/[id]/lessons — crée une leçon sous un chapitre. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const { id: chapterId } = await params;
  const chapter = await db.chapter.findUnique({ where: { id: chapterId } });
  if (!chapter) {
    return Response.json({ error: "Chapitre parent introuvable." }, { status: 404 });
  }

  const parsed = await parseJsonBody(req, adminLessonCreateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const existing = await db.lesson.findUnique({
    where: { chapterId_slug: { chapterId, slug: data.slug } },
  });
  if (existing) {
    return Response.json({ error: "Ce slug est déjà utilisé dans ce chapitre." }, { status: 409 });
  }

  const lesson = await db.lesson.create({
    data: {
      chapterId,
      slug: data.slug,
      title: data.title,
      summary: data.summary,
      content: data.content,
      estimatedMinutes: data.estimatedMinutes,
      order: data.order,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
    },
  });
  await logAdminAction(guard.user.id, "LESSON_CREATE", `lesson:${lesson.id}`, {
    chapterId,
    slug: lesson.slug,
    title: lesson.title,
  });
  return Response.json({ ok: true, lesson }, { status: 201 });
}
