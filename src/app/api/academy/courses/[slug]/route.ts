import { db } from "@/lib/db";
import { getCourseTree } from "@/lib/bitquest/academy";

/** Arbre du cours (chapitres + leçons) avec marqueurs de complétion si authentifié. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const userId = req.headers.get("x-gn-user-id");
  const token = req.headers.get("x-gn-token");
  let authedUserId: string | null = null;
  if (userId && token) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (user && user.token === token) authedUserId = user.id;
  }
  const course = await getCourseTree(slug, authedUserId);
  if (!course) return Response.json({ error: "Cours introuvable." }, { status: 404 });
  return Response.json({ course });
}
