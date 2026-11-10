import { db } from "@/lib/db";
import { authenticate, buildClearSessionCookie } from "@/lib/bitquest/session";
import crypto from "crypto";

/**
 * Déconnecte la session courante :
 * - rote le `User.token` (le cookie / les headers ne sont plus valides),
 * - renvoie un Set-Cookie qui supprime le cookie `bq_session`.
 *
 * Idempotent : toujours 200 même si aucune session n'est trouvée (le cookie
 * est supprimé côté client dans tous les cas).
 */
export async function POST(req: Request) {
  const user = await authenticate(req);
  if (user) {
    await db.user.update({
      where: { id: user.id },
      data: { token: crypto.randomBytes(24).toString("hex") },
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": buildClearSessionCookie(),
    },
  });
}
