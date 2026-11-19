/**
 * GET /api/admin/ai/courses — liste légère des cours pour le picker IA.
 * Retourne slug + title + chapters count. Rôle EDITOR+.
 */
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/roles";

export async function GET(req: Request) {
  // GET read-only — pas de CSRF (opération idempotente).
  const guard = await requireRole(req, "EDITOR");
  if (!guard.ok) return guard.response;

  const courses = await db.course.findMany({
    orderBy: [{ order: "asc" }, { title: "asc" }],
    select: {
      slug: true,
      title: true,
      subtitle: true,
      publishedAt: true,
      _count: { select: { chapters: true } },
      chapters: {
        orderBy: { order: "asc" },
        select: { slug: true, title: true },
      },
    },
  });

  return Response.json({
    courses: courses.map((c) => ({
      slug: c.slug,
      title: c.title,
      subtitle: c.subtitle,
      published: c.publishedAt !== null,
      chaptersCount: c._count.chapters,
      chapters: c.chapters,
    })),
  });
}
