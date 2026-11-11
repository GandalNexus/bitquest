import { authenticate, clientIp, rateLimit, unauthorized } from "@/lib/bitquest/session";
import { isCookieAuthenticated, requireCsrf } from "@/lib/auth/csrf";
import { issueLaunchToken, LAUNCH_TOKEN_TTL_SECONDS } from "@/lib/auth/launch-token";
import { PROTOCOL_VERSION } from "@/lib/bitlab/protocol";

/**
 * POST /api/auth/launch-token — émet un JWT court-terme qui identifie
 * l'utilisateur BitQuest courant pour BitLab.
 *
 * Usage typique : BitQuest l'appelle juste avant d'ouvrir une deep-link
 * BitLab (utilisé aussi directement par /api/bitlab/deep-link). Le token
 * est destiné à être consommé une seule fois par le serveur BitLab via
 * /api/auth/verify-launch-token.
 */
export async function POST(req: Request) {
  if (!(await rateLimit(`launch-token-ip:${clientIp(req)}`, 60, 60_000))) {
    return Response.json({ error: "Trop de requêtes depuis cette IP." }, { status: 429 });
  }
  const user = await authenticate(req);
  if (!user) return unauthorized();
  if (isCookieAuthenticated(req)) {
    const csrf = requireCsrf(req, user.token);
    if (!csrf.ok) return csrf.response;
  }
  if (!(await rateLimit(`launch-token:${user.id}`, 15, 60_000))) {
    return Response.json({ error: "Trop de tokens demandés, patiente une minute." }, { status: 429 });
  }

  const { token, expiresAt, nonce } = await issueLaunchToken({
    userId: user.id,
    pseudo: user.pseudo,
    role: user.role,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
  });

  return Response.json({
    ok: true,
    token,
    nonce,
    expiresAt: expiresAt.toISOString(),
    ttlSeconds: LAUNCH_TOKEN_TTL_SECONDS,
    protocolVersion: PROTOCOL_VERSION,
  });
}
