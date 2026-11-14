import { db } from "@/lib/db";
import { logger } from "@/lib/log";
import { isFeatureEnabled } from "@/lib/feature-flag";
import { decodeInvoice } from "@/lib/bitlab/bolt11";
import { getLndConfig, type LndConfig } from "@/lib/bitlab/lnd";
import { lndRouterSend } from "./rewards-lnd";

const log = logger("lightning-rewards");

/* ============================================================
 * sendReward — P4 : paiement Lightning RÉEL vers un invoice fourni
 * par l'apprenant. Strictement isolé des sats simulés (`User.sats`,
 * `WalletTransaction`). Jamais mélanger les deux flux comptables
 * (manifesto GandalNexus § séparation stricte).
 *
 * Gardes empilées, chacune doit répondre vrai pour qu'un sat réel
 * quitte le node LND :
 *   1. Feature flag `lightning.rewards` (par user ou global).
 *   2. LND configuré (LND_REST_URL + LND_MACAROON_HEX).
 *   3. `LND_SEND_REWARDS_LIVE=1` (kill-switch explicite — permet de
 *      dry-run en staging sans toucher de vrais sats).
 *   4. Invoice bolt11 décodable, non-mainnet, montant ≤ cap.
 *
 * Toujours crée un LightningReward row (traçabilité ops). Status :
 *   - PENDING : créé, LND pas encore sollicité.
 *   - PAID    : LND a renvoyé un preimage.
 *   - FAILED  : LND a renvoyé une erreur OU une garde a bloqué le flow.
 *
 * ⚠️ Toujours logger via `logger("lightning-rewards")` et ne JAMAIS
 * utiliser `logger("bitquest")` ou `logger("audit")` pour ces événements
 * (séparation stricte des journaux sim vs réel).
 * ============================================================ */

/** Plafond par défaut pour éviter un sinistre si flag mal-configuré. */
const DEFAULT_MAX_MSAT = 100_000_000; // 100 000 sats

export interface SendRewardInput {
  userId: string;
  invoiceBolt11: string;
  /** Contexte libre (JSON) : questCode, triggeredBy, etc. */
  context?: Record<string, unknown>;
  /** Override du plafond msat (défaut DEFAULT_MAX_MSAT). */
  maxMsat?: number;
}

export type SendRewardStatus = "PAID" | "FAILED";

export interface SendRewardResult {
  status: SendRewardStatus;
  rewardId: string;
  amountMsat: number;
  feeMsat: number | null;
  preimageHex: string | null;
  failureReason: string | null;
}

/** Codes d'erreur stables (pour tests + UI). */
export const SendRewardFailure = {
  FLAG_DISABLED: "FLAG_DISABLED",
  LND_UNCONFIGURED: "LND_UNCONFIGURED",
  LIVE_MODE_OFF: "LIVE_MODE_OFF",
  INVOICE_INVALID: "INVOICE_INVALID",
  INVOICE_MAINNET: "INVOICE_MAINNET",
  INVOICE_NO_AMOUNT: "INVOICE_NO_AMOUNT",
  INVOICE_OVER_CAP: "INVOICE_OVER_CAP",
  LND_ERROR: "LND_ERROR",
  LND_NO_PREIMAGE: "LND_NO_PREIMAGE",
} as const;
export type SendRewardFailureCode =
  (typeof SendRewardFailure)[keyof typeof SendRewardFailure];

/** Vérifie l'env kill-switch live (inlined pour mockabilité). */
function isLiveModeEnabled(): boolean {
  return process.env.LND_SEND_REWARDS_LIVE === "1";
}

/**
 * Déclenche un paiement Lightning récompense. Toujours crée une ligne
 * `LightningReward` même si le paiement est refusé par une garde — ça
 * matérialise la tentative dans l'audit séparé.
 */
export async function sendReward(input: SendRewardInput): Promise<SendRewardResult> {
  const { userId, invoiceBolt11 } = input;
  const maxMsat = input.maxMsat ?? DEFAULT_MAX_MSAT;
  const context = input.context ?? {};
  const contextJson = JSON.stringify(context);

  // Garde 1 : feature flag
  const flagOn = await isFeatureEnabled("lightning.rewards", userId);
  if (!flagOn) {
    return failReward(userId, invoiceBolt11, 0, contextJson, SendRewardFailure.FLAG_DISABLED);
  }

  // Garde 2 : invoice décodable + non mainnet
  let amountMsat: number;
  try {
    const decoded = decodeInvoice(invoiceBolt11);
    if (decoded.network === "mainnet") {
      return failReward(
        userId,
        invoiceBolt11,
        0,
        contextJson,
        SendRewardFailure.INVOICE_MAINNET,
      );
    }
    if (decoded.amountMsat === null || decoded.amountMsat <= 0) {
      return failReward(
        userId,
        invoiceBolt11,
        0,
        contextJson,
        SendRewardFailure.INVOICE_NO_AMOUNT,
      );
    }
    amountMsat = decoded.amountMsat;
  } catch {
    return failReward(userId, invoiceBolt11, 0, contextJson, SendRewardFailure.INVOICE_INVALID);
  }

  // Garde 3 : plafond
  if (amountMsat > maxMsat) {
    return failReward(
      userId,
      invoiceBolt11,
      amountMsat,
      contextJson,
      SendRewardFailure.INVOICE_OVER_CAP,
    );
  }

  // Garde 4 : LND configuré
  const lnd = getLndConfig();
  if (!lnd) {
    return failReward(
      userId,
      invoiceBolt11,
      amountMsat,
      contextJson,
      SendRewardFailure.LND_UNCONFIGURED,
    );
  }

  // Garde 5 : kill-switch live
  if (!isLiveModeEnabled()) {
    return failReward(
      userId,
      invoiceBolt11,
      amountMsat,
      contextJson,
      SendRewardFailure.LIVE_MODE_OFF,
    );
  }

  // Toutes les gardes OK — on persiste PENDING, puis on tente LND.
  const row = await db.lightningReward.create({
    data: {
      userId,
      invoiceBolt11,
      amountMsat,
      status: "PENDING",
      attemptContext: contextJson,
    },
  });

  log.info({ userId, rewardId: row.id, amountMsat }, "lightning reward dispatching to LND");

  const outcome = await payViaLnd(lnd, invoiceBolt11);
  if (!outcome.ok) {
    await db.lightningReward.update({
      where: { id: row.id },
      data: { status: "FAILED", failureReason: outcome.reason },
    });
    log.warn({ userId, rewardId: row.id, reason: outcome.reason }, "lightning reward failed");
    return {
      status: "FAILED",
      rewardId: row.id,
      amountMsat,
      feeMsat: null,
      preimageHex: null,
      failureReason: outcome.reason,
    };
  }

  const updated = await db.lightningReward.update({
    where: { id: row.id },
    data: {
      status: "PAID",
      preimageHex: outcome.preimageHex,
      feeMsat: outcome.feeMsat,
      paidAt: new Date(),
    },
  });
  log.info(
    { userId, rewardId: row.id, amountMsat, feeMsat: outcome.feeMsat },
    "lightning reward paid",
  );
  return {
    status: "PAID",
    rewardId: updated.id,
    amountMsat,
    feeMsat: outcome.feeMsat,
    preimageHex: outcome.preimageHex,
    failureReason: null,
  };
}

/**
 * Enregistre un échec dans `LightningReward` et retourne le résultat
 * normalisé. Utilisé par chaque garde pour matérialiser la tentative
 * dans l'audit (jamais de garde silencieuse).
 */
async function failReward(
  userId: string,
  invoiceBolt11: string,
  amountMsat: number,
  contextJson: string,
  code: SendRewardFailureCode,
): Promise<SendRewardResult> {
  const row = await db.lightningReward.create({
    data: {
      userId,
      invoiceBolt11,
      amountMsat,
      status: "FAILED",
      failureReason: code,
      attemptContext: contextJson,
    },
  });
  log.warn({ userId, rewardId: row.id, code, amountMsat }, "lightning reward blocked");
  return {
    status: "FAILED",
    rewardId: row.id,
    amountMsat,
    feeMsat: null,
    preimageHex: null,
    failureReason: code,
  };
}

/* ============================================================
 * Interprétation de la réponse LND /v2/router/send. Le fetch HTTP
 * lui-même vit dans `rewards-lnd.ts` (séparé pour pouvoir le mocker
 * sans toucher à `node:https` global, qui fait partie du runtime
 * Prisma / Vitest).
 * ============================================================ */

interface LndPayResult {
  ok: boolean;
  reason: string;
  preimageHex: string;
  feeMsat: number | null;
}

interface LndPaymentResponse {
  status?: string;
  payment_preimage?: string;
  fee_msat?: string | number;
  failure_reason?: string;
}

async function payViaLnd(cfg: LndConfig, invoice: string): Promise<LndPayResult> {
  try {
    const resp = await lndRouterSend(cfg, invoice);
    if (resp.status !== 200 || !resp.body || typeof resp.body !== "object") {
      return {
        ok: false,
        reason: `LND_ERROR_${resp.status}`,
        preimageHex: "",
        feeMsat: null,
      };
    }
    const body = resp.body as LndPaymentResponse;
    const status = typeof body.status === "string" ? body.status.toUpperCase() : "";
    const preimage = typeof body.payment_preimage === "string" ? body.payment_preimage : "";
    const feeMsat = parseLndMsat(body.fee_msat);
    if (status === "SUCCEEDED" && preimage.length === 64) {
      return { ok: true, reason: "", preimageHex: preimage, feeMsat };
    }
    if (preimage.length !== 64) {
      return { ok: false, reason: "LND_NO_PREIMAGE", preimageHex: "", feeMsat: null };
    }
    const failReason =
      typeof body.failure_reason === "string" && body.failure_reason.length > 0
        ? `LND_${body.failure_reason}`
        : `LND_STATUS_${status || "UNKNOWN"}`;
    return { ok: false, reason: failReason, preimageHex: "", feeMsat };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? `LND_ERROR_${err.message}` : "LND_ERROR_UNKNOWN",
      preimageHex: "",
      feeMsat: null,
    };
  }
}

function parseLndMsat(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && /^\d+$/.test(raw)) return Number(raw);
  return null;
}
