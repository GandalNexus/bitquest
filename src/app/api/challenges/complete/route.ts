import { authenticate, rateLimit, unauthorized } from "@/lib/bitquest/session";
import { isCookieAuthenticated, requireCsrf } from "@/lib/auth/csrf";
import { completeTodayChallenge } from "@/lib/bitquest/challenges";

/** POST /api/challenges/complete — valide le défi du jour pour l'utilisateur. */
export async function POST(req: Request) {
  const user = await authenticate(req);
  if (!user) return unauthorized();
  if (isCookieAuthenticated(req)) {
    const csrf = requireCsrf(req, user.token);
    if (!csrf.ok) return csrf.response;
  }
  if (!(await rateLimit(`challenge:${user.id}`, 10, 60_000))) {
    return Response.json({ error: "Trop de requêtes, patiente une minute." }, { status: 429 });
  }

  const result = await completeTodayChallenge(user.id);
  if (!result.ok) {
    return Response.json(
      { error: "Pas de défi disponible aujourd'hui." },
      { status: 404 },
    );
  }
  return Response.json({
    ok: true,
    alreadyCompleted: result.alreadyCompleted,
    xpGained: result.xpGained,
    satsGranted: result.satsGranted,
    satsCapped: result.satsCapped,
  });
}
