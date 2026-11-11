import { db } from "@/lib/db";
import { authenticate, rateLimit, unauthorized } from "@/lib/bitquest/session";
import { isCookieAuthenticated, requireCsrf } from "@/lib/auth/csrf";
import { getTransaction, getBlock, getAddressStats, type Network } from "@/lib/bitlab/mempool";
import { decodeInvoice } from "@/lib/bitlab/bolt11";
import { resolveChannel, isValidChannelIdentifier } from "@/lib/bitlab/lightning";
import {
  parseAddressVerifyLevel,
  validateAddressFormat,
  type AddressVerifyLevel,
} from "@/lib/bitlab/address";
import { verifyChallengeOrRespond } from "@/lib/bitlab/jwt";
import { fireProofAttempt, type ProofOutcome } from "@/lib/bitlab/audit";
import { bitlabProofSchema, parseJsonBody } from "@/lib/validation/schemas";
import { logger } from "@/lib/log";

const log = logger("bitlab-proof");

/**
 * POST /api/bitlab/proof — soumet une preuve de mission BitLab.
 *
 * Toutes les sorties du handler (succès ou refus) alimentent le journal
 * d'audit BitLabProofAttempt via fireProofAttempt.
 */
export async function POST(req: Request) {
  const startedAt = Date.now();
  const user = await authenticate(req);
  if (!user) return unauthorized();
  if (isCookieAuthenticated(req)) {
    const csrf = requireCsrf(req, user.token);
    if (!csrf.ok) return csrf.response;
  }
  if (!(await rateLimit(`bitlab-proof:${user.id}`, 20, 60_000))) {
    fireProofAttempt({
      userId: user.id,
      questCode: "",
      kind: "",
      network: "",
      outcome: "RATE_LIMITED",
      startedAt,
    });
    return Response.json({ error: "Trop de tentatives, patiente une minute." }, { status: 429 });
  }

  const parsed = await parseJsonBody(req, bitlabProofSchema);
  if (!parsed.ok) {
    fireProofAttempt({
      userId: user.id,
      questCode: "",
      kind: "",
      network: "",
      outcome: "BAD_REQUEST",
      reasonMessage: "schema validation failed",
      startedAt,
    });
    return parsed.response;
  }
  const { questCode, kind, network, payload, challenge } = parsed.data;

  const audit = (outcome: ProofOutcome, reason?: string) =>
    fireProofAttempt({
      userId: user.id,
      questCode,
      kind,
      network,
      outcome,
      reasonMessage: reason ?? null,
      startedAt,
    });

  // Vérifie que la quête existe (pas de FK Prisma mais on refuse les quêtes inconnues).
  const quest = await db.quest.findUnique({
    where: { code: questCode },
    select: { id: true, missionConfig: true },
  });
  if (!quest) {
    audit("BAD_REQUEST", "quest inconnue");
    return Response.json({ error: "Quête inconnue." }, { status: 404 });
  }

  // JWT challenge obligatoire : vérifie signature + expiry + consomme le nonce.
  const chk = await verifyChallengeOrRespond(challenge);
  if (!chk.ok) {
    audit("INVALID_JWT", "signature/expiry/nonce");
    return chk.response;
  }
  const claims = chk.claims;
  if (claims.userId !== user.id || claims.questCode !== questCode || claims.kind !== kind) {
    audit("INVALID_JWT", "mismatch user/quest/kind");
    return Response.json(
      { error: "JWT bitlab : paire (user, quest, kind) ne correspond pas." },
      { status: 400 },
    );
  }

  // Vérif explorateur selon le kind.
  if (kind === "TX") {
    const txid = typeof payload.txid === "string" ? payload.txid : null;
    if (!txid || !/^[0-9a-f]{64}$/i.test(txid)) {
      audit("BAD_REQUEST", "txid mal formé");
      return Response.json({ error: "txid manquant ou mal formé." }, { status: 400 });
    }
    const tx = await getTransaction(network as Network, txid);
    if (!tx) {
      audit("NOT_FOUND", "tx introuvable");
      return Response.json({ error: "Transaction introuvable sur l'explorateur." }, { status: 404 });
    }
    if (!tx.confirmed) {
      audit("MEMPOOL");
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
      audit("BAD_REQUEST", "hash mal formé");
      return Response.json({ error: "hash de bloc manquant ou mal formé." }, { status: 400 });
    }
    const block = await getBlock(network as Network, hash);
    if (!block) {
      audit("NOT_FOUND", "block introuvable");
      return Response.json({ error: "Bloc introuvable sur l'explorateur." }, { status: 404 });
    }
    payload.height = block.height;
    payload.tx_count = block.tx_count;
  }
  if (kind === "INVOICE") {
    const bolt11 = typeof payload.bolt11 === "string" ? payload.bolt11 : null;
    if (!bolt11) {
      audit("BAD_REQUEST", "bolt11 manquant");
      return Response.json({ error: "Invoice BOLT11 manquante dans payload.bolt11." }, { status: 400 });
    }
    try {
      const decoded = decodeInvoice(bolt11);
      payload.amountSats = decoded.amountSats;
      payload.network = decoded.network;
      payload.paymentHash = decoded.paymentHash;
      payload.expiry = decoded.expiry;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invoice invalide.";
      audit("REJECTED", `bolt11 invalide: ${msg}`);
      return Response.json({ error: msg }, { status: 400 });
    }
  }
  if (kind === "CHANNEL") {
    const scid = typeof payload.scid === "string" ? payload.scid : null;
    if (!scid || !isValidChannelIdentifier(scid)) {
      audit("BAD_REQUEST", "scid mal formé");
      return Response.json(
        { error: "payload.scid doit être <block>x<tx>x<vout> ou un chan_id numérique." },
        { status: 400 },
      );
    }
    const { channel, source } = await resolveChannel(network as Network, scid);
    if (source === "unavailable") {
      audit("UNAVAILABLE", "LND non configuré");
      return Response.json(
        {
          error:
            "Vérification de channel Lightning indisponible sur ce réseau : configurez LND_REST_URL et LND_MACAROON_HEX.",
        },
        { status: 501 },
      );
    }
    if (!channel) {
      audit("NOT_FOUND", "channel introuvable");
      return Response.json(
        { error: "Channel Lightning introuvable sur l'explorateur." },
        { status: 404 },
      );
    }
    payload.scid = channel.shortId ?? scid;
    payload.channelId = channel.id;
    payload.capacity = channel.capacity;
    payload.status = channel.status;
    payload.nodeLeftPub = channel.nodeLeftPub;
    payload.nodeRightPub = channel.nodeRightPub;
    payload.transactionId = channel.transactionId;
    payload.source = source;
  }
  if (kind === "ADDRESS") {
    const addressRaw = typeof payload.address === "string" ? payload.address : null;
    if (!addressRaw) {
      audit("BAD_REQUEST", "address manquante");
      return Response.json(
        { error: "payload.address manquant." },
        { status: 400 },
      );
    }
    const format = validateAddressFormat(network as Network, addressRaw);
    if (!format.valid) {
      audit("BAD_REQUEST", format.reason);
      return Response.json(
        { error: format.reason ?? "Adresse invalide." },
        { status: 400 },
      );
    }

    const level: AddressVerifyLevel = parseAddressVerifyLevel(quest.missionConfig);
    payload.address = addressRaw.trim();
    payload.format = format.format;
    payload.verifyLevel = level;

    if (level === "USED") {
      const stats = await getAddressStats(network as Network, payload.address as string);
      if (!stats) {
        audit("NOT_FOUND", "address introuvable sur l'explorateur");
        return Response.json(
          { error: "Adresse introuvable sur l'explorateur." },
          { status: 404 },
        );
      }
      if (stats.fundedTxoCount === 0) {
        audit("REJECTED", "address jamais utilisée (funded_txo_count=0)");
        return Response.json(
          {
            error: "Adresse jamais créditée on-chain. Reçois au moins 1 sat avant de valider.",
            fundedTxoCount: 0,
          },
          { status: 409 },
        );
      }
      payload.fundedTxoCount = stats.fundedTxoCount;
      payload.fundedTxoSumSats = stats.fundedTxoSumSats;
      payload.txCount = stats.txCount;
    }
  }

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
  audit("ACCEPTED");

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
