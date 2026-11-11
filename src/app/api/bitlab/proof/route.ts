import { db } from "@/lib/db";
import { authenticate, clientIp, rateLimit, unauthorized } from "@/lib/bitquest/session";
import { isCookieAuthenticated, requireCsrf } from "@/lib/auth/csrf";
import { getTransaction, getBlock, getAddressStats, type Network } from "@/lib/bitlab/mempool";
import { decodeInvoice } from "@/lib/bitlab/bolt11";
import { resolveChannel, isValidChannelIdentifier } from "@/lib/bitlab/lightning";
import { parseChannelVerifyLevel } from "@/lib/bitlab/channel";
import {
  parseAddressVerifyLevel,
  validateAddressFormat,
  type AddressVerifyLevel,
} from "@/lib/bitlab/address";
import { verifyChallengeOrRespond } from "@/lib/bitlab/jwt";
import { fireProofAttempt, type ProofOutcome } from "@/lib/bitlab/audit";
import { transitionAttempt, getAttemptForUser } from "@/lib/bitlab/attempt";
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
  // Rate-limit IP AVANT auth (anti-DoS), ratio × 4 du userId limit.
  if (!(await rateLimit(`bitlab-proof-ip:${clientIp(req)}`, 80, 60_000))) {
    return Response.json({ error: "Trop de requêtes depuis cette IP." }, { status: 429 });
  }
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

  // Résolution de l'attemptId depuis les claims JWT (LOT 1). Si présent,
  // transition IN_PROGRESS → PROOF_PENDING avant toute vérif métier.
  // Un rejet métier transitera PROOF_PENDING → FAILED, un succès → COMPLETED.
  const attemptId = claims.attemptId;
  let attemptSnapshot = null as Awaited<ReturnType<typeof getAttemptForUser>>;
  if (attemptId) {
    attemptSnapshot = await getAttemptForUser(attemptId, user.id);
    if (!attemptSnapshot) {
      audit("BAD_REQUEST", "attemptId inconnu");
      return Response.json(
        { error: "Tentative BitLab introuvable." },
        { status: 404 },
      );
    }
    if (
      attemptSnapshot.questCode !== questCode ||
      attemptSnapshot.kind !== kind ||
      attemptSnapshot.network !== network
    ) {
      audit("BAD_REQUEST", "attempt mismatch quest/kind/network");
      return Response.json(
        { error: "Tentative BitLab : quête, kind ou network ne correspond pas." },
        { status: 400 },
      );
    }
    // Idempotence : si déjà COMPLETED, on renvoie un succès idempotent
    // sans refaire la vérif réseau — évite les doubles crédits en cas de
    // ré-ouverture du lien de retour.
    if (attemptSnapshot.state === "COMPLETED") {
      audit("DUPLICATE", "attempt déjà COMPLETED");
      return Response.json({
        ok: true,
        idempotent: true,
        attempt: {
          id: attemptSnapshot.id,
          state: attemptSnapshot.state,
          completedAt: attemptSnapshot.completedAt?.toISOString() ?? null,
          resultJson: attemptSnapshot.resultJson,
        },
      });
    }
    // Transition PROOF_PENDING. Accepte tout état actif non-terminal pour
    // tolérer un client qui re-soumet (anti-réseau flaky).
    const tr = await transitionAttempt({
      attemptId,
      userId: user.id,
      to: "PROOF_PENDING",
      from: ["CREATED", "IN_PROGRESS", "PROOF_PENDING"],
    });
    if (!tr.ok && tr.reason === "EXPIRED") {
      audit("BAD_REQUEST", "attempt expiré");
      return Response.json(
        { error: "Tentative BitLab expirée. Relance la mission depuis BitQuest." },
        { status: 410 },
      );
    }
  }

  /**
   * Transition de l'attempt vers FAILED avec motif. No-op si pas d'attemptId.
   * Utilisé pour tous les rejets métier (mauvais format, tx introuvable,
   * mempool, bolt11 invalide, …).
   */
  const failAttempt = async (reason: string) => {
    if (!attemptId) return;
    await transitionAttempt({
      attemptId,
      userId: user.id,
      to: "FAILED",
      from: ["PROOF_PENDING", "VERIFYING"],
      failReason: reason.slice(0, 200),
    });
  };

  /**
   * Transition PROOF_PENDING → VERIFYING juste avant un appel externe
   * (mempool, LND, bolt11 decode). No-op sans attemptId.
   */
  const toVerifying = async () => {
    if (!attemptId) return;
    await transitionAttempt({
      attemptId,
      userId: user.id,
      to: "VERIFYING",
      from: ["PROOF_PENDING"],
    });
  };

  /**
   * Helper de rejet : audit, transition FAILED, puis renvoie la Response.
   * Centralise les 11 chemins d'erreur métier pour éviter les oublis.
   */
  const reject = async (
    outcome: ProofOutcome,
    reason: string | null,
    body: Record<string, unknown>,
    status: number,
  ) => {
    audit(outcome, reason ?? undefined);
    await failAttempt(reason ?? outcome);
    return Response.json(body, { status });
  };

  // Vérif explorateur selon le kind.
  if (kind === "TX") {
    const txid = typeof payload.txid === "string" ? payload.txid : null;
    if (!txid || !/^[0-9a-f]{64}$/i.test(txid)) {
      return reject("BAD_REQUEST", "txid mal formé", { error: "txid manquant ou mal formé." }, 400);
    }
    await toVerifying();
    const tx = await getTransaction(network as Network, txid);
    if (!tx) {
      return reject("NOT_FOUND", "tx introuvable", { error: "Transaction introuvable sur l'explorateur." }, 404);
    }
    if (!tx.confirmed) {
      return reject("MEMPOOL", null, { error: "Transaction en mempool, pas encore confirmée.", mempool: true }, 409);
    }
    payload.confirmed = true;
    payload.blockHeight = tx.blockHeight;
    payload.blockHash = tx.blockHash;
    payload.feeSats = tx.feeSats;
  } else if (kind === "BLOCK") {
    const hash = typeof payload.hash === "string" ? payload.hash : null;
    if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) {
      return reject("BAD_REQUEST", "hash mal formé", { error: "hash de bloc manquant ou mal formé." }, 400);
    }
    await toVerifying();
    const block = await getBlock(network as Network, hash);
    if (!block) {
      return reject("NOT_FOUND", "block introuvable", { error: "Bloc introuvable sur l'explorateur." }, 404);
    }
    payload.height = block.height;
    payload.tx_count = block.tx_count;
  }
  if (kind === "INVOICE") {
    const bolt11 = typeof payload.bolt11 === "string" ? payload.bolt11 : null;
    if (!bolt11) {
      return reject("BAD_REQUEST", "bolt11 manquant", { error: "Invoice BOLT11 manquante dans payload.bolt11." }, 400);
    }
    await toVerifying();
    try {
      const decoded = decodeInvoice(bolt11);
      payload.amountSats = decoded.amountSats;
      payload.network = decoded.network;
      payload.paymentHash = decoded.paymentHash;
      payload.expiry = decoded.expiry;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invoice invalide.";
      return reject("REJECTED", `bolt11 invalide: ${msg}`, { error: msg }, 400);
    }
  }
  if (kind === "CHANNEL") {
    const scid = typeof payload.scid === "string" ? payload.scid : null;
    if (!scid || !isValidChannelIdentifier(scid)) {
      return reject(
        "BAD_REQUEST",
        "scid mal formé",
        { error: "payload.scid doit être <block>x<tx>x<vout> ou un chan_id numérique." },
        400,
      );
    }

    // Niveau DECLARATIVE : format valide = preuve acceptée, pas d'appel réseau.
    // À réserver aux quêtes pédagogiques sans récompense sats réelle (P2.4).
    const channelLevel = parseChannelVerifyLevel(quest.missionConfig);
    if (channelLevel === "DECLARATIVE") {
      payload.scid = scid.trim();
      payload.verifyLevel = "DECLARATIVE";
      payload.source = "declarative";
    } else {
      await toVerifying();
      const { channel, source } = await resolveChannel(network as Network, scid);
      if (source === "unavailable") {
        return reject(
          "UNAVAILABLE",
          "LND non configuré",
          {
            error:
              "Vérification de channel Lightning indisponible sur ce réseau : configurez LND_REST_URL et LND_MACAROON_HEX.",
          },
          501,
        );
      }
      if (!channel) {
        return reject(
          "NOT_FOUND",
          "channel introuvable",
          { error: "Channel Lightning introuvable sur l'explorateur." },
          404,
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
      payload.verifyLevel = "ONCHAIN";
    }
  }
  if (kind === "ADDRESS") {
    const addressRaw = typeof payload.address === "string" ? payload.address : null;
    if (!addressRaw) {
      return reject("BAD_REQUEST", "address manquante", { error: "payload.address manquant." }, 400);
    }
    const format = validateAddressFormat(network as Network, addressRaw);
    if (!format.valid) {
      return reject("BAD_REQUEST", format.reason ?? "format invalide", { error: format.reason ?? "Adresse invalide." }, 400);
    }

    const level: AddressVerifyLevel = parseAddressVerifyLevel(quest.missionConfig);
    payload.address = addressRaw.trim();
    payload.format = format.format;
    payload.verifyLevel = level;

    if (level === "USED") {
      await toVerifying();
      const stats = await getAddressStats(network as Network, payload.address as string);
      if (!stats) {
        return reject(
          "NOT_FOUND",
          "address introuvable sur l'explorateur",
          { error: "Adresse introuvable sur l'explorateur." },
          404,
        );
      }
      if (stats.fundedTxoCount === 0) {
        return reject(
          "REJECTED",
          "address jamais utilisée (funded_txo_count=0)",
          {
            error: "Adresse jamais créditée on-chain. Reçois au moins 1 sat avant de valider.",
            fundedTxoCount: 0,
          },
          409,
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

  // Transition finale de l'attempt vers COMPLETED (idempotent).
  // Accepte VERIFYING (chemin normal) ou PROOF_PENDING (DECLARATIVE court-circuite
  // le toVerifying() — pas de vérif externe à faire).
  if (attemptId) {
    await transitionAttempt({
      attemptId,
      userId: user.id,
      to: "COMPLETED",
      from: ["PROOF_PENDING", "VERIFYING"],
      proofId: proof.id,
    });
  }

  return Response.json({
    ok: true,
    proof: {
      id: proof.id,
      kind: proof.kind,
      network: proof.network,
      verifiedAt: proof.verifiedAt.toISOString(),
      consumed: proof.consumed,
    },
    attemptId: attemptId ?? null,
  });
}
