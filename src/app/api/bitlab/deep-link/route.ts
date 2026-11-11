import { authenticate, rateLimit, unauthorized } from "@/lib/bitquest/session";
import { isCookieAuthenticated, requireCsrf } from "@/lib/auth/csrf";
import { bitlabDeepLinkSchema, parseJsonBody } from "@/lib/validation/schemas";
import { buildBitlabDeepLink, signDeepLinkPayload } from "@/lib/bitlab/deep-link";

function getSignSecret(): string | null {
  return process.env.BITLAB_SIGN_SECRET?.trim() || null;
}

/**
 * POST /api/bitlab/deep-link — construit l'URL deep-link de BitLab.
 *
 * Si BITLAB_SIGN_SECRET est configuré, l'URL est signée (params `sig`
 * et `ts` ajoutés). Sinon, l'URL est non signée (comportement legacy).
 * Le client peut appeler l'endpoint sans se soucier du secret.
 */
export async function POST(req: Request) {
  const user = await authenticate(req);
  if (!user) return unauthorized();
  if (isCookieAuthenticated(req)) {
    const csrf = requireCsrf(req, user.token);
    if (!csrf.ok) return csrf.response;
  }
  if (!(await rateLimit(`bitlab-deep-link:${user.id}`, 30, 60_000))) {
    return Response.json({ error: "Trop de requêtes, patiente une minute." }, { status: 429 });
  }

  const parsed = await parseJsonBody(req, bitlabDeepLinkSchema);
  if (!parsed.ok) return parsed.response;
  const { questCode, kind, network, returnTo } = parsed.data;

  const base =
    process.env.NEXT_PUBLIC_BITLAB_URL?.trim() || "https://bitlab.example/mission";

  const secret = getSignSecret();
  const extra: Record<string, string | number> = {};
  let signed = false;
  if (secret) {
    const ts = Math.floor(Date.now() / 1000);
    const sig = signDeepLinkPayload({
      userId: user.id,
      questCode,
      kind,
      network,
      ts,
      secret,
    });
    extra.ts = ts;
    extra.sig = sig;
    signed = true;
  }

  const url = buildBitlabDeepLink({
    base,
    questCode,
    kind,
    network,
    returnTo,
    extra,
  });

  return Response.json({ ok: true, url, signed });
}
