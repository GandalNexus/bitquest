import { db } from "@/lib/db";
import { SESSION_COOKIE, parseCookieHeader } from "@/lib/bitquest/session";
import { getTodayChallenge } from "@/lib/bitquest/challenges";

/** GET /api/challenges/today — défi du jour (auth optionnelle). */
export async function GET(req: Request) {
  // Auth best-effort : on accepte cookie OU header legacy, sans unauthorize.
  let userId: string | null = null;
  const cookieToken = parseCookieHeader(req.headers.get("cookie"))[SESSION_COOKIE];
  if (cookieToken) {
    const user = await db.user.findUnique({ where: { token: cookieToken } });
    if (user) userId = user.id;
  } else {
    const hUser = req.headers.get("x-gn-user-id");
    const hToken = req.headers.get("x-gn-token");
    if (hUser && hToken) {
      const user = await db.user.findUnique({ where: { id: hUser } });
      if (user && user.token === hToken) userId = user.id;
    }
  }
  const challenge = await getTodayChallenge(userId);
  return Response.json({ challenge });
}
