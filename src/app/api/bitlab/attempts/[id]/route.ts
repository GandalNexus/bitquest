import { authenticate, clientIp, rateLimit, unauthorized } from "@/lib/bitquest/session";
import { isCookieAuthenticated, requireCsrf } from "@/lib/auth/csrf";
import { getAttemptForUser, transitionAttempt } from "@/lib/bitlab/attempt";
import { bitlabAttemptActionSchema, parseJsonBody } from "@/lib/validation/schemas";

/**
 * GET /api/bitlab/attempts/:id — récupère l'état courant d'une tentative.
 *
 * Résout : reprise d'une mission après interruption (refresh navigateur,
 * changement d'onglet, reconnexion). User-scoped : un autre utilisateur ne
 * peut pas sonder les tentatives d'autrui.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await rateLimit(`bitlab-attempt-get-ip:${clientIp(req)}`, 240, 60_000))) {
    return Response.json({ error: "Trop de requêtes depuis cette IP." }, { status: 429 });
  }
  const user = await authenticate(req);
  if (!user) return unauthorized();
  if (!(await rateLimit(`bitlab-attempt-get:${user.id}`, 60, 60_000))) {
    return Response.json({ error: "Trop de requêtes, patiente une minute." }, { status: 429 });
  }

  const { id } = await params;
  const row = await getAttemptForUser(id, user.id);
  if (!row) {
    return Response.json({ error: "Tentative introuvable." }, { status: 404 });
  }
  return Response.json({
    ok: true,
    attempt: serialize(row),
  });
}

/**
 * POST /api/bitlab/attempts/:id — transitions explicites côté client.
 *
 * Supporte uniquement `abandon` pour l'instant : l'utilisateur ferme la
 * mission sans soumettre de preuve. Les transitions terminales serveur
 * (COMPLETED, FAILED, EXPIRED) ne sont PAS exposées ici.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await rateLimit(`bitlab-attempt-post-ip:${clientIp(req)}`, 60, 60_000))) {
    return Response.json({ error: "Trop de requêtes depuis cette IP." }, { status: 429 });
  }
  const user = await authenticate(req);
  if (!user) return unauthorized();
  if (isCookieAuthenticated(req)) {
    const csrf = requireCsrf(req, user.token);
    if (!csrf.ok) return csrf.response;
  }
  if (!(await rateLimit(`bitlab-attempt-post:${user.id}`, 15, 60_000))) {
    return Response.json({ error: "Trop de requêtes, patiente une minute." }, { status: 429 });
  }

  const parsed = await parseJsonBody(req, bitlabAttemptActionSchema);
  if (!parsed.ok) return parsed.response;

  const { id } = await params;
  const tr = await transitionAttempt({
    attemptId: id,
    userId: user.id,
    to: "ABANDONED",
    from: ["CREATED", "IN_PROGRESS", "PROOF_PENDING"],
  });
  if (!tr.ok) {
    if (tr.reason === "NOT_FOUND") {
      return Response.json({ error: "Tentative introuvable." }, { status: 404 });
    }
    if (tr.reason === "EXPIRED") {
      return Response.json({ error: "Tentative déjà expirée." }, { status: 410 });
    }
    return Response.json(
      { error: "Impossible d'abandonner : état incompatible." },
      { status: 409 },
    );
  }

  const updated = await getAttemptForUser(id, user.id);
  return Response.json({
    ok: true,
    attempt: updated ? serialize(updated) : null,
  });
}

function serialize(row: {
  id: string;
  questCode: string;
  kind: string;
  network: string;
  state: string;
  launchedAt: Date;
  expiresAt: Date;
  completedAt: Date | null;
  abandonedAt: Date | null;
  failedAt: Date | null;
  failReason: string | null;
  proofId: string | null;
  resultJson: string | null;
  returnTo: string | null;
}) {
  let result: unknown = null;
  if (row.resultJson) {
    try {
      result = JSON.parse(row.resultJson);
    } catch {
      result = null;
    }
  }
  return {
    id: row.id,
    questCode: row.questCode,
    kind: row.kind,
    network: row.network,
    state: row.state,
    launchedAt: row.launchedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    abandonedAt: row.abandonedAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
    failReason: row.failReason,
    proofId: row.proofId,
    result,
    returnTo: row.returnTo,
  };
}
