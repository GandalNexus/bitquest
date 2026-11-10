import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { adminCourseCreateSchema, parseJsonBody } from "@/lib/validation/schemas";

/** POST /api/admin/courses — crée un cours (ADMIN). */
export async function POST(req: Request) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const parsed = await parseJsonBody(req, adminCourseCreateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const existing = await db.course.findUnique({ where: { slug: data.slug } });
  if (existing) {
    return Response.json({ error: "Ce slug est déjà utilisé." }, { status: 409 });
  }

  const course = await db.course.create({
    data: {
      slug: data.slug,
      title: data.title,
      subtitle: data.subtitle,
      description: data.description,
      coverIcon: data.coverIcon,
      order: data.order,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
    },
  });
  await logAdminAction(guard.user.id, "COURSE_CREATE", `course:${course.id}`, {
    slug: course.slug,
    title: course.title,
  });
  return Response.json({ ok: true, course }, { status: 201 });
}
