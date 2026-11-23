import { db } from "@/lib/db";
import { getCoursesSummary } from "@/lib/bitquest/academy";

/**
 * Catalogue des cours publiés. Authentification optionnelle : si l'utilisateur
 * est reconnu, on inclut sa progression ; sinon, les compteurs restent à 0.
 */
export async function GET(req: Request) {
  const userId = req.headers.get("x-gn-user-id");
  const token = req.headers.get("x-gn-token");
  let authedUserId: string | null = null;
  if (userId && token) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (user && user.token === token) authedUserId = user.id;
  }
  const courses = await getCoursesSummary(authedUserId);
  return Response.json({ courses });
}
