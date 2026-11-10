import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { adminChapterCreateSchema, parseJsonBody } from "@/lib/validation/schemas";

/** POST /api/admin/courses/[id]/chapters — crée un chapitre sous un cours. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const { id: courseId } = await params;
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return Response.json({ error: "Cours parent introuvable." }, { status: 404 });
  }

  const parsed = await parseJsonBody(req, adminChapterCreateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const existing = await db.chapter.findUnique({
    where: { courseId_slug: { courseId, slug: data.slug } },
  });
  if (existing) {
    return Response.json({ error: "Ce slug est déjà utilisé dans ce cours." }, { status: 409 });
  }

  const chapter = await db.chapter.create({
    data: {
      courseId,
      slug: data.slug,
      title: data.title,
      summary: data.summary,
      order: data.order,
    },
  });
  return Response.json({ ok: true, chapter }, { status: 201 });
}
