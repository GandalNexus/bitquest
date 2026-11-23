import { db } from "@/lib/db";
import { authenticate, clientIp, rateLimit, unauthorized } from "@/lib/bitquest/session";
import { isCookieAuthenticated, requireCsrf } from "@/lib/auth/csrf";
import { freshNonce, issueChallenge, PROTOCOL_VERSION } from "@/lib/bitlab/jwt";
import {
  getAttemptForUser,
  transitionAttempt,
  findLatestActiveAttempt,
} from "@/lib/bitlab/attempt";
import { bitlabChallengeSchema, parseJsonBody } from "@/lib/validation/schemas";
import { jsonWithProtocolVersion } from "@/lib/bitlab/response";

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
    return jsonWithProtocolVersion(
      { error: "Trop de requêtes depuis cette IP." },
      { status: 429 },
    );
  }
  const user = await authenticate(req);
  if (!user) return unauthorized();
  if (isCookieAuthenticated(req)) {
    const csrf = requireCsrf(req, user.token);
    if (!csrf.ok) return csrf.response;
  }
  if (!(await rateLimit(`bitlab-challenge:${user.id}`, 30, 60_000))) {
    return jsonWithProtocolVersion(
      { error: "Trop de défis demandés, patiente une minute." },
      { status: 429 },
    );
  }

  const parsed = await parseJsonBody(req, bitlabChallengeSchema);
  if (!parsed.ok) return parsed.response;
  const { questCode, kind, attemptId: attemptIdInput } = parsed.data;

  // Vérifie que la quête existe (évite les JWT pour des quêtes fantômes).
  const quest = await db.quest.findUnique({ where: { code: questCode }, select: { id: true } });
  if (!quest) {
    return jsonWithProtocolVersion({ error: "Quête inconnue." }, { status: 404 });
  }

  // Résolution de l'attemptId : explicite via query, sinon dernière tentative
  // active pour ce (user, quest, kind) — compat ascendante avec BitLab non
  // encore patché. Si aucune tentative, le flux continue (traçabilité non
  // enforced sur cette route, seule /deep-link crée une row).
  let attemptId: string | undefined;
  if (attemptIdInput) {
    const row = await getAttemptForUser(attemptIdInput, user.id);
    if (!row) {
      return jsonWithProtocolVersion(
        { error: "Tentative BitLab introuvable." },
        { status: 404 },
      );
    }
    if (row.questCode !== questCode || row.kind !== kind) {
      return jsonWithProtocolVersion(
        { error: "Tentative BitLab : quête ou kind ne correspond pas." },
        { status: 400 },
      );
    }
    attemptId = row.id;
    // Transition souple : si déjà IN_PROGRESS on ne retransite pas.
    if (row.state === "CREATED") {
      await transitionAttempt({
        attemptId: row.id,
        userId: user.id,
        to: "IN_PROGRESS",
        from: "CREATED",
      });
    }
  } else {
    const active = await findLatestActiveAttempt(user.id, questCode, kind);
    if (active) {
      attemptId = active.id;
      if (active.state === "CREATED") {
        await transitionAttempt({
          attemptId: active.id,
          userId: user.id,
          to: "IN_PROGRESS",
          from: "CREATED",
        });
      }
    }
  }

  const nonce = freshNonce();
  const { token, expiresAt } = await issueChallenge({
    userId: user.id,
    questCode,
    kind,
    nonce,
    attemptId,
  });

  return jsonWithProtocolVersion({
    ok: true,
    token,
    nonce,
    expiresAt: expiresAt.toISOString(),
    protocolVersion: PROTOCOL_VERSION,
    attemptId,
  });
}
