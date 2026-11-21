import crypto from "crypto";
import { db } from "@/lib/db";
import {
  authenticate,
  buildClearSessionCookie,
  clientIp,
  rateLimit,
} from "@/lib/bitquest/session";
import { buildClearCsrfCookie } from "@/lib/auth/csrf";
import { isOriginAllowed } from "@/lib/auth/cors";
import { logger } from "@/lib/log";

const log = logger("bitlab-logout");

/**
 * GET /api/auth/bitlab-logout?returnTo=<url>
 *
 * Miroir top-level de `/api/auth/bitlab-sso` pour la déconnexion globale :
 * BitLab y renvoie l'utilisateur, BitQuest rote `User.token`, supprime les
 * cookies `bq_session` + `bq_csrf`, puis redirige 302 vers
 * `<returnTo>?logged_out=1`.
 *
 * Idempotent : si pas de session trouvée, on nettoie quand même les
 * cookies et on redirige (rendre la boucle « déconnexion globale »
 * tolérante aux doubles clics).
 *
 * Sécurité :
 * - `returnTo` validé contre `BITLAB_ALLOWED_ORIGINS` (même allowlist que
 *   /api/auth/bitlab-sso) pour éviter que la page de retour soit une
 *   origine tierce.
 * - Pas de CSRF : un attaquant qui déconnecte n'exfiltre rien et le user
 *   peut toujours se reconnecter.
 * - Rate-limit IP 30/60s (même budget que bitlab-sso).
 */

function validateReturnTo(raw: string | null): URL | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const originStr = `${url.protocol}//${url.host}`;
  if (!isOriginAllowed(originStr)) return null;
  return url;
}

export async function GET(req: Request) {
  if (!(await rateLimit(`bitlab-logout-ip:${clientIp(req)}`, 30, 60_000))) {
    return Response.json(
      { error: "Trop de requêtes depuis cette IP." },
      { status: 429 },
    );
  }

  const inputUrl = new URL(req.url);
  const returnToRaw = inputUrl.searchParams.get("returnTo");
  const returnTo = validateReturnTo(returnToRaw);

  if (!returnTo) {
    log.warn({ msg: "returnTo invalide ou hors allowlist", returnTo: returnToRaw });
    return Response.json(
      { error: "Paramètre returnTo invalide ou hors allowlist BitLab." },
      { status: 400 },
    );
  }

  const user = await authenticate(req);
  if (user) {
    try {
      await db.user.update({
        where: { id: user.id },
        data: { token: crypto.randomBytes(24).toString("hex") },
      });
      log.info({ msg: "Déconnexion globale BitLab", userId: user.id });
    } catch (err) {
      log.warn({
        msg: "Rotation du token user en échec — poursuite du logout",
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const target = new URL(returnTo.toString());
  target.searchParams.set("logged_out", "1");

  const headers = new Headers({ Location: target.toString() });
  headers.append("Set-Cookie", buildClearSessionCookie());
  headers.append("Set-Cookie", buildClearCsrfCookie());
  return new Response(null, { status: 302, headers });
}
