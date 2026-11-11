import { authenticate, rateLimit, unauthorized } from "@/lib/bitquest/session";
import { isCookieAuthenticated, requireCsrf } from "@/lib/auth/csrf";
import { bitlabDeepLinkVerifySchema, parseJsonBody } from "@/lib/validation/schemas";
import { verifyDeepLinkPayload } from "@/lib/bitlab/deep-link";

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
  const user = await authenticate(req);
  if (!user) return unauthorized();
  if (isCookieAuthenticated(req)) {
    const csrf = requireCsrf(req, user.token);
    if (!csrf.ok) return csrf.response;
  }
  if (!(await rateLimit(`bitlab-dl-verify:${user.id}`, 60, 60_000))) {
    return Response.json({ error: "Trop de requêtes, patiente une minute." }, { status: 429 });
  }

  const parsed = await parseJsonBody(req, bitlabDeepLinkVerifySchema);
  if (!parsed.ok) return parsed.response;
  const { questCode, kind, network, ts, sig } = parsed.data;

  const secret = getSignSecret();
  if (!secret) {
    return Response.json({ ok: true, enforced: false });
  }

  const valid = verifyDeepLinkPayload({
    userId: user.id,
    questCode,
    kind,
    network,
    ts,
    sig,
    secret,
  });

  return Response.json({ ok: valid, enforced: true });
}
