import { authenticate, clientIp, rateLimit, unauthorized } from "@/lib/bitquest/session";
import { isCookieAuthenticated, requireCsrf } from "@/lib/auth/csrf";
import { bitlabDeepLinkVerifySchema, parseJsonBody } from "@/lib/validation/schemas";
import { verifyDeepLinkPayload } from "@/lib/bitlab/deep-link";
import { jsonWithProtocolVersion } from "@/lib/bitlab/response";

function getSignSecret(): string | null {
  return process.env.BITLAB_SIGN_SECRET?.trim() || null;
}

/**
 * POST /api/bitlab/deep-link/verify-return — vérifie qu'un retour BitLab
 * est authentique (signature HMAC + ts frais).
 *
 * Si BITLAB_SIGN_SECRET n'est pas configuré, l'endpoint renvoie
 * `{ ok: true, enforced: false }` (nothing to verify). Sinon, il
 * vérifie et retourne `{ ok: true | false, enforced: true }`.
 */
export async function POST(req: Request) {
  // Rate-limit IP AVANT auth (anti-DoS), ratio × 4 du userId limit.
  if (!(await rateLimit(`bitlab-dl-verify-ip:${clientIp(req)}`, 240, 60_000))) {
    return jsonWithProtocolVersion({ error: "Trop de requêtes depuis cette IP." }, { status: 429 });
  }
  const user = await authenticate(req);
  if (!user) return unauthorized();
  if (isCookieAuthenticated(req)) {
    const csrf = requireCsrf(req, user.token);
    if (!csrf.ok) return csrf.response;
  }
  if (!(await rateLimit(`bitlab-dl-verify:${user.id}`, 60, 60_000))) {
    return jsonWithProtocolVersion({ error: "Trop de requêtes, patiente une minute." }, { status: 429 });
  }

  const parsed = await parseJsonBody(req, bitlabDeepLinkVerifySchema);
  if (!parsed.ok) return parsed.response;
  const { questCode, kind, network, ts, sig, v } = parsed.data;

  const secret = getSignSecret();
  if (!secret) {
    return jsonWithProtocolVersion({ ok: true, enforced: false });
  }

  const valid = verifyDeepLinkPayload({
    userId: user.id,
    questCode,
    kind,
    network,
    ts,
    sig,
    secret,
    v,
  });

  return jsonWithProtocolVersion({ ok: valid, enforced: true });
}
