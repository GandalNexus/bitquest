import { authenticate, rateLimit, unauthorized } from "@/lib/bitquest/session";
import { isCookieAuthenticated, requireCsrf } from "@/lib/auth/csrf";
import { completeLesson } from "@/lib/bitquest/academy";

/** Marque une leçon comme terminée pour l'utilisateur authentifié (idempotent). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await authenticate(req);
  if (!user) return unauthorized();
  if (isCookieAuthenticated(req)) {
    const csrf = requireCsrf(req, user.token);
    if (!csrf.ok) return csrf.response;
  }
  if (!(await rateLimit(`lesson-complete:${user.id}`, 60, 60_000))) {
    return Response.json({ error: "Trop de requêtes, réessaie dans un instant." }, { status: 429 });
  }
  const { id } = await params;
  const result = await completeLesson(user.id, id);
  if (!result.ok) {
    return Response.json({ error: "Leçon introuvable." }, { status: 404 });
  }
  return Response.json({
    alreadyCompleted: result.alreadyCompleted,
    completedAt: result.completedAt,
  });
}
