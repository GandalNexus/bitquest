import { db } from "@/lib/db";
import { authenticate, buildClearSessionCookie } from "@/lib/bitquest/session";
import { buildClearCsrfCookie } from "@/lib/auth/csrf";
import crypto from "crypto";

/**
 * Déconnecte la session courante :
 * - rote le `User.token` (le cookie / les headers ne sont plus valides),
 * - supprime les cookies `bq_session` (HttpOnly) et `bq_csrf` (readable).
 *
 * Idempotent : toujours 200 même si aucune session n'est trouvée.
 * NB : exempt de CSRF — un attaquant qui déconnecte n'exfiltre rien.
 */
export async function POST(req: Request) {
  const user = await authenticate(req);
  if (user) {
    await db.user.update({
      where: { id: user.id },
      data: { token: crypto.randomBytes(24).toString("hex") },
    });
  }
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", buildClearSessionCookie());
  headers.append("Set-Cookie", buildClearCsrfCookie());
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
