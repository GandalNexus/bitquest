import { db } from "@/lib/db";
import { authenticate, clientIp, rateLimit, unauthorized } from "@/lib/bitquest/session";
import { isCookieAuthenticated, requireCsrf } from "@/lib/auth/csrf";
import { freshNonce, issueChallenge, PROTOCOL_VERSION } from "@/lib/bitlab/jwt";
import { bitlabChallengeSchema, parseJsonBody } from "@/lib/validation/schemas";

/**
 * POST /api/bitlab/challenge — émet un JWT signé qui autorise l'apprenant
 * à soumettre une preuve de mission pour (questCode, kind) sous 1 heure.
 *
 * Le JWT contient un nonce aléatoire qui sera consommé par /api/bitlab/proof,
 * rendant chaque JWT utilisable une seule fois.
 */
export async function POST(req: Request) {
  // Rate-limit IP AVANT auth : protège contre DoS non-authentifié
  // (ratio × 4 par rapport au rate-limit userId pour tolérer NAT/famille/école).
  if (!(await rateLimit(`bitlab-challenge-ip:${clientIp(req)}`, 120, 60_000))) {
    return Response.json({ error: "Trop de requêtes depuis cette IP." }, { status: 429 });
  }
  const user = await authenticate(req);
  if (!user) return unauthorized();
  if (isCookieAuthenticated(req)) {
    const csrf = requireCsrf(req, user.token);
    if (!csrf.ok) return csrf.response;
  }
  if (!(await rateLimit(`bitlab-challenge:${user.id}`, 30, 60_000))) {
    return Response.json({ error: "Trop de défis demandés, patiente une minute." }, { status: 429 });
  }

  const parsed = await parseJsonBody(req, bitlabChallengeSchema);
  if (!parsed.ok) return parsed.response;
  const { questCode, kind } = parsed.data;

  // Vérifie que la quête existe (évite les JWT pour des quêtes fantômes).
  const quest = await db.quest.findUnique({ where: { code: questCode }, select: { id: true } });
  if (!quest) {
    return Response.json({ error: "Quête inconnue." }, { status: 404 });
  }

  const nonce = freshNonce();
  const { token, expiresAt } = await issueChallenge({
    userId: user.id,
    questCode,
    kind,
    nonce,
  });

  return Response.json({
    ok: true,
    token,
    nonce,
    expiresAt: expiresAt.toISOString(),
    protocolVersion: PROTOCOL_VERSION,
  });
}
