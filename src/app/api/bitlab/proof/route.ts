import { db } from "@/lib/db";
import { authenticate, rateLimit, unauthorized } from "@/lib/bitquest/session";
import { isCookieAuthenticated, requireCsrf } from "@/lib/auth/csrf";
import { getTransaction, getBlock, type Network } from "@/lib/bitlab/mempool";
import { decodeInvoice } from "@/lib/bitlab/bolt11";
import { verifyChallengeOrRespond } from "@/lib/bitlab/jwt";
import { bitlabProofSchema, parseJsonBody } from "@/lib/validation/schemas";
import { logger } from "@/lib/log";

const log = logger("bitlab-proof");

/**
 * POST /api/bitlab/proof — soumet une preuve de mission BitLab.
 *
 * Phase 3 foundation : l'endpoint persiste une BitLabProof vérifiée côté
 * explorateur (mempool.space / blockstream), MAIS ne remet AUCUN XP/sats
 * encore — le câblage « preuve → récompense » quête-par-quête viendra
 * dans un sprint ultérieur pour éviter une bascule brutale.
 *
 * Kinds supportés en v1 :
 *   - TX     : { txid } → lookup mempool, confirmed requis
 *   - BLOCK  : { hash } → lookup mempool
 *   - INVOICE, CHANNEL, ADDRESS : acceptés en structure mais non vérifiés
 *     encore (nécessitent BOLT11 decoder + LND api côté serveur, hors de
 *     cette foundation)
 */
export async function POST(req: Request) {
  const user = await authenticate(req);
  if (!user) return unauthorized();
  if (isCookieAuthenticated(req)) {
    const csrf = requireCsrf(req, user.token);
    if (!csrf.ok) return csrf.response;
  }
  if (!(await rateLimit(`bitlab-proof:${user.id}`, 20, 60_000))) {
    return Response.json({ error: "Trop de tentatives, patiente une minute." }, { status: 429 });
  }

  const parsed = await parseJsonBody(req, bitlabProofSchema);
  if (!parsed.ok) return parsed.response;
  const { questCode, kind, network, payload, challenge } = parsed.data;

  // Vérifie que la quête existe (pas de FK Prisma mais on refuse les quêtes inconnues).
  const quest = await db.quest.findUnique({ where: { code: questCode }, select: { id: true } });
  if (!quest) {
    return Response.json({ error: "Quête inconnue." }, { status: 404 });
  }

  // Si un JWT challenge est fourni, le vérifier et consommer le nonce.
  if (challenge) {
    const chk = await verifyChallengeOrRespond(challenge);
    if (!chk.ok) return chk.response;
    const claims = chk.claims;
    if (claims.userId !== user.id || claims.questCode !== questCode || claims.kind !== kind) {
      return Response.json(
        { error: "JWT bitlab : paire (user, quest, kind) ne correspond pas." },
        { status: 400 },
      );
    }
  }

  // Vérif explorateur selon le kind.
  if (kind === "TX") {
    const txid = typeof payload.txid === "string" ? payload.txid : null;
    if (!txid || !/^[0-9a-f]{64}$/i.test(txid)) {
      return Response.json({ error: "txid manquant ou mal formé." }, { status: 400 });
    }
    const tx = await getTransaction(network as Network, txid);
    if (!tx) {
      return Response.json({ error: "Transaction introuvable sur l'explorateur." }, { status: 404 });
    }
    if (!tx.confirmed) {
      return Response.json(
        { error: "Transaction en mempool, pas encore confirmée.", mempool: true },
        { status: 409 },
      );
    }
    payload.confirmed = true;
    payload.blockHeight = tx.blockHeight;
    payload.blockHash = tx.blockHash;
    payload.feeSats = tx.feeSats;
  } else if (kind === "BLOCK") {
    const hash = typeof payload.hash === "string" ? payload.hash : null;
    if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) {
      return Response.json({ error: "hash de bloc manquant ou mal formé." }, { status: 400 });
    }
    const block = await getBlock(network as Network, hash);
    if (!block) {
      return Response.json({ error: "Bloc introuvable sur l'explorateur." }, { status: 404 });
    }
    payload.height = block.height;
    payload.tx_count = block.tx_count;
  }
  if (kind === "INVOICE") {
    const bolt11 = typeof payload.bolt11 === "string" ? payload.bolt11 : null;
    if (!bolt11) {
      return Response.json({ error: "Invoice BOLT11 manquante dans payload.bolt11." }, { status: 400 });
    }
    try {
      const decoded = decodeInvoice(bolt11);
      payload.amountSats = decoded.amountSats;
      payload.network = decoded.network;
      payload.paymentHash = decoded.paymentHash;
      payload.expiry = decoded.expiry;
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Invoice invalide." },
        { status: 400 },
      );
    }
  }
  // CHANNEL / ADDRESS : acceptés en l'état pour l'instant.

  // Upsert idempotent sur (user, questCode, kind).
  const proof = await db.bitLabProof.upsert({
    where: { userId_questCode_kind: { userId: user.id, questCode, kind } },
    update: {
      network,
      payload: JSON.stringify(payload),
      verifiedAt: new Date(),
    },
    create: {
      userId: user.id,
      questCode,
      kind,
      network,
      payload: JSON.stringify(payload),
    },
  });

  log.info({ userId: user.id, questCode, kind, network }, "bitlab proof accepted");

  return Response.json({
    ok: true,
    proof: {
      id: proof.id,
      kind: proof.kind,
      network: proof.network,
      verifiedAt: proof.verifiedAt.toISOString(),
      consumed: proof.consumed,
    },
  });
}
