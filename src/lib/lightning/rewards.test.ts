import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ============================================================
 * Mocks hoistés — Prisma, feature flag, bolt11 decoder, LND config.
 * On ne touche jamais au réseau réel (ni LND, ni Redis).
 * ============================================================ */

const dbMock = vi.hoisted(() => ({
  lightningReward: {
    create: vi.fn(),
    update: vi.fn(),
    aggregate: vi.fn(),
  },
  // Rails « simulés » : jamais touchés par sendReward (vérifié par test
  // d'isolation stricte plus bas — manifesto GandalNexus).
  user: { update: vi.fn() },
  walletTransaction: { create: vi.fn() },
  userEvent: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

const flagMock = vi.hoisted(() => ({
  isFeatureEnabled: vi.fn(),
}));
vi.mock("@/lib/feature-flag", () => flagMock);

const bolt11Mock = vi.hoisted(() => ({
  decodeInvoice: vi.fn(),
}));
vi.mock("@/lib/bitlab/bolt11", () => bolt11Mock);

const lndMock = vi.hoisted(() => ({
  getLndConfig: vi.fn(),
}));
vi.mock("@/lib/bitlab/lnd", () => lndMock);

// On mock la couche wire LND séparée ; pas besoin de toucher
// `node:https` global (Prisma / Vitest en dépendent).
const lndRouterSendMock = vi.hoisted(() => vi.fn());
vi.mock("./rewards-lnd", () => ({ lndRouterSend: lndRouterSendMock }));

import { sendReward, SendRewardFailure } from "./rewards";

const USER_ID = "user-abc";
const INVOICE = "lntb10u1somemockinvoice";

let originalLive: string | undefined;

beforeEach(() => {
  dbMock.lightningReward.create.mockReset();
  dbMock.lightningReward.update.mockReset();
  dbMock.lightningReward.aggregate.mockReset();
  dbMock.lightningReward.aggregate.mockResolvedValue({ _sum: { amountMsat: 0 } });
  flagMock.isFeatureEnabled.mockReset();
  bolt11Mock.decodeInvoice.mockReset();
  lndMock.getLndConfig.mockReset();
  lndRouterSendMock.mockReset();

  dbMock.lightningReward.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    id: "reward-id",
    ...args.data,
  }));
  dbMock.lightningReward.update.mockImplementation(async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
    id: args.where.id,
    ...args.data,
  }));

  originalLive = process.env.LND_SEND_REWARDS_LIVE;
  delete process.env.LND_SEND_REWARDS_LIVE;
});

afterEach(() => {
  if (originalLive === undefined) delete process.env.LND_SEND_REWARDS_LIVE;
  else process.env.LND_SEND_REWARDS_LIVE = originalLive;
  vi.clearAllMocks();
});

describe("sendReward — gardes", () => {
  it("refuse si le feature flag est OFF", async () => {
    flagMock.isFeatureEnabled.mockResolvedValue(false);
    const res = await sendReward({ userId: USER_ID, invoiceBolt11: INVOICE });
    expect(res.status).toBe("FAILED");
    expect(res.failureReason).toBe(SendRewardFailure.FLAG_DISABLED);
    expect(dbMock.lightningReward.create).toHaveBeenCalledOnce();
    expect(lndRouterSendMock).not.toHaveBeenCalled();
  });

  it("refuse une invoice non décodable", async () => {
    flagMock.isFeatureEnabled.mockResolvedValue(true);
    bolt11Mock.decodeInvoice.mockImplementation(() => {
      throw new Error("Invoice BOLT11 mal formée.");
    });
    const res = await sendReward({ userId: USER_ID, invoiceBolt11: "garbage" });
    expect(res.status).toBe("FAILED");
    expect(res.failureReason).toBe(SendRewardFailure.INVOICE_INVALID);
    expect(lndRouterSendMock).not.toHaveBeenCalled();
  });

  it("refuse une invoice mainnet", async () => {
    flagMock.isFeatureEnabled.mockResolvedValue(true);
    bolt11Mock.decodeInvoice.mockReturnValue({
      amountSats: 10,
      amountMsat: 10_000,
      network: "mainnet",
      timestamp: 0,
      expiry: 3600,
      paymentHash: null,
      description: null,
      payeeNodeKey: "",
    });
    const res = await sendReward({ userId: USER_ID, invoiceBolt11: INVOICE });
    expect(res.status).toBe("FAILED");
    expect(res.failureReason).toBe(SendRewardFailure.INVOICE_MAINNET);
  });

  it("refuse une invoice sans montant", async () => {
    flagMock.isFeatureEnabled.mockResolvedValue(true);
    bolt11Mock.decodeInvoice.mockReturnValue({
      amountSats: null,
      amountMsat: null,
      network: "testnet",
      timestamp: 0,
      expiry: 3600,
      paymentHash: null,
      description: null,
      payeeNodeKey: "",
    });
    const res = await sendReward({ userId: USER_ID, invoiceBolt11: INVOICE });
    expect(res.status).toBe("FAILED");
    expect(res.failureReason).toBe(SendRewardFailure.INVOICE_NO_AMOUNT);
  });

  it("refuse une invoice au-dessus du plafond", async () => {
    flagMock.isFeatureEnabled.mockResolvedValue(true);
    bolt11Mock.decodeInvoice.mockReturnValue({
      amountSats: 1_000_000,
      amountMsat: 1_000_000_000,
      network: "testnet",
      timestamp: 0,
      expiry: 3600,
      paymentHash: null,
      description: null,
      payeeNodeKey: "",
    });
    const res = await sendReward({ userId: USER_ID, invoiceBolt11: INVOICE, maxMsat: 100_000 });
    expect(res.status).toBe("FAILED");
    expect(res.failureReason).toBe(SendRewardFailure.INVOICE_OVER_CAP);
  });

  it("refuse si plafond 24h dépassé (sum existing + new > daily cap)", async () => {
    flagMock.isFeatureEnabled.mockResolvedValue(true);
    bolt11Mock.decodeInvoice.mockReturnValue({
      amountSats: 10,
      amountMsat: 10_000,
      network: "testnet",
      timestamp: 0,
      expiry: 3600,
      paymentHash: null,
      description: null,
      payeeNodeKey: "",
    });
    // Déjà 9 500 msat crédités (PAID + PENDING) sur 24h : nouvelle
    // demande de 10 000 msat → 19 500 > maxDailyMsat 15 000.
    dbMock.lightningReward.aggregate.mockResolvedValueOnce({
      _sum: { amountMsat: 9_500 },
    });
    const res = await sendReward({
      userId: USER_ID,
      invoiceBolt11: INVOICE,
      maxDailyMsat: 15_000,
    });
    expect(res.status).toBe("FAILED");
    expect(res.failureReason).toBe(SendRewardFailure.INVOICE_OVER_DAILY_CAP);
    expect(lndRouterSendMock).not.toHaveBeenCalled();
  });

  it("refuse si plafond 7j dépassé (daily OK, weekly KO)", async () => {
    flagMock.isFeatureEnabled.mockResolvedValue(true);
    bolt11Mock.decodeInvoice.mockReturnValue({
      amountSats: 10,
      amountMsat: 10_000,
      network: "testnet",
      timestamp: 0,
      expiry: 3600,
      paymentHash: null,
      description: null,
      payeeNodeKey: "",
    });
    // 1er appel aggregate = fenêtre 24h → 5 000 (OK avec maxDailyMsat 20 000)
    // 2e appel aggregate = fenêtre 7j → 90 000 (+ 10 000 = 100 000 > 50 000)
    dbMock.lightningReward.aggregate
      .mockResolvedValueOnce({ _sum: { amountMsat: 5_000 } })
      .mockResolvedValueOnce({ _sum: { amountMsat: 90_000 } });
    const res = await sendReward({
      userId: USER_ID,
      invoiceBolt11: INVOICE,
      maxDailyMsat: 20_000,
      maxWeeklyMsat: 50_000,
    });
    expect(res.status).toBe("FAILED");
    expect(res.failureReason).toBe(SendRewardFailure.INVOICE_OVER_WEEKLY_CAP);
    expect(lndRouterSendMock).not.toHaveBeenCalled();
  });

  it("refuse si LND n'est pas configuré", async () => {
    flagMock.isFeatureEnabled.mockResolvedValue(true);
    bolt11Mock.decodeInvoice.mockReturnValue({
      amountSats: 10,
      amountMsat: 10_000,
      network: "testnet",
      timestamp: 0,
      expiry: 3600,
      paymentHash: null,
      description: null,
      payeeNodeKey: "",
    });
    lndMock.getLndConfig.mockReturnValue(null);
    const res = await sendReward({ userId: USER_ID, invoiceBolt11: INVOICE });
    expect(res.status).toBe("FAILED");
    expect(res.failureReason).toBe(SendRewardFailure.LND_UNCONFIGURED);
  });

  it("refuse si le kill-switch live est éteint", async () => {
    flagMock.isFeatureEnabled.mockResolvedValue(true);
    bolt11Mock.decodeInvoice.mockReturnValue({
      amountSats: 10,
      amountMsat: 10_000,
      network: "testnet",
      timestamp: 0,
      expiry: 3600,
      paymentHash: null,
      description: null,
      payeeNodeKey: "",
    });
    lndMock.getLndConfig.mockReturnValue({
      url: "https://lnd:8080",
      macaroonHex: "cafe",
      tlsInsecure: true,
      tlsCa: null,
    });
    const res = await sendReward({ userId: USER_ID, invoiceBolt11: INVOICE });
    expect(res.status).toBe("FAILED");
    expect(res.failureReason).toBe(SendRewardFailure.LIVE_MODE_OFF);
    expect(lndRouterSendMock).not.toHaveBeenCalled();
  });

  it("toutes les gardes matérialisent une ligne LightningReward (audit)", async () => {
    flagMock.isFeatureEnabled.mockResolvedValue(false);
    await sendReward({ userId: USER_ID, invoiceBolt11: INVOICE });
    expect(dbMock.lightningReward.create).toHaveBeenCalledOnce();
    const call = dbMock.lightningReward.create.mock.calls[0]?.[0] as {
      data: { userId: string; status: string; failureReason: string };
    };
    expect(call.data.userId).toBe(USER_ID);
    expect(call.data.status).toBe("FAILED");
    expect(call.data.failureReason).toBe(SendRewardFailure.FLAG_DISABLED);
  });
});

describe("sendReward — chemin LND live (mocké)", () => {
  function mockLndSuccess(preimage: string, feeMsat: number) {
    lndRouterSendMock.mockResolvedValue({
      status: 200,
      body: { status: "SUCCEEDED", payment_preimage: preimage, fee_msat: feeMsat },
    });
  }

  function mockLndFailure(status: string, reason: string) {
    lndRouterSendMock.mockResolvedValue({
      status: 200,
      body: { status, payment_preimage: "", failure_reason: reason },
    });
  }

  beforeEach(() => {
    flagMock.isFeatureEnabled.mockResolvedValue(true);
    bolt11Mock.decodeInvoice.mockReturnValue({
      amountSats: 10,
      amountMsat: 10_000,
      network: "testnet",
      timestamp: 0,
      expiry: 3600,
      paymentHash: null,
      description: null,
      payeeNodeKey: "",
    });
    lndMock.getLndConfig.mockReturnValue({
      url: "https://lnd:8080",
      macaroonHex: "cafe",
      tlsInsecure: true,
      tlsCa: null,
    });
    process.env.LND_SEND_REWARDS_LIVE = "1";
  });

  it("paiement LND réussi → PAID + preimage + feeMsat persisté", async () => {
    const preimage = "a".repeat(64);
    mockLndSuccess(preimage, 42);
    const res = await sendReward({ userId: USER_ID, invoiceBolt11: INVOICE });
    expect(res.status).toBe("PAID");
    expect(res.preimageHex).toBe(preimage);
    expect(res.feeMsat).toBe(42);
    expect(dbMock.lightningReward.create).toHaveBeenCalledOnce();
    expect(dbMock.lightningReward.update).toHaveBeenCalledOnce();
    const updateArgs = dbMock.lightningReward.update.mock.calls[0]?.[0] as {
      data: { status: string; preimageHex: string; paidAt: Date };
    };
    expect(updateArgs.data.status).toBe("PAID");
    expect(updateArgs.data.preimageHex).toBe(preimage);
    expect(updateArgs.data.paidAt).toBeInstanceOf(Date);
  });

  it("paiement LND échoué (FAILED_NO_ROUTE) → FAILED avec reason préfixée", async () => {
    mockLndFailure("FAILED", "NO_ROUTE");
    const res = await sendReward({ userId: USER_ID, invoiceBolt11: INVOICE });
    expect(res.status).toBe("FAILED");
    expect(res.failureReason).toMatch(/^LND_/);
  });

  // Manifesto GandalNexus § séparation stricte des flux sats simulés vs
  // réels. sendReward() ne doit JAMAIS mettre à jour User.sats, ni créer
  // de WalletTransaction (comptabilité simulée), ni d'UserEvent (type
  // SATS_EARNED simulé). Le seul rail d'audit pour les sats réels est
  // LightningReward. Toute régression ici ouvrirait un vecteur de
  // confusion comptable sim/réel — à bloquer frontalement.
  it("isolation stricte : ne touche ni User.sats ni WalletTransaction ni UserEvent", async () => {
    const preimage = "b".repeat(64);
    mockLndSuccess(preimage, 10);
    const res = await sendReward({ userId: USER_ID, invoiceBolt11: INVOICE });
    expect(res.status).toBe("PAID");
    expect(dbMock.user.update).not.toHaveBeenCalled();
    expect(dbMock.walletTransaction.create).not.toHaveBeenCalled();
    expect(dbMock.userEvent.create).not.toHaveBeenCalled();
  });
});
