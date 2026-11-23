import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

async function loadWithFetch(impl: typeof fetch) {
  globalThis.fetch = impl;
  return import("./lightning");
}

describe("isValidChannelIdentifier", () => {
  it("accepte short_id format <block>x<tx>x<vout>", async () => {
    const { isValidChannelIdentifier } = await import("./lightning");
    expect(isValidChannelIdentifier("859100x1234x0")).toBe(true);
    expect(isValidChannelIdentifier("1x0x0")).toBe(true);
  });

  it("accepte un channel ID numérique long", async () => {
    const { isValidChannelIdentifier } = await import("./lightning");
    expect(isValidChannelIdentifier("840123456789")).toBe(true);
  });

  it("refuse formats invalides", async () => {
    const { isValidChannelIdentifier } = await import("./lightning");
    expect(isValidChannelIdentifier("abc")).toBe(false);
    expect(isValidChannelIdentifier("")).toBe(false);
    expect(isValidChannelIdentifier("123")).toBe(false); // trop court
    expect(isValidChannelIdentifier("859100x1234")).toBe(false); // manque vout
  });
});

describe("LightningClient.getChannel", () => {
  it("retourne les champs normalisés depuis mempool.space", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 840123456789,
          short_id: "859100x1234x0",
          capacity: 5_000_000,
          status: "active",
          transaction_id: "tx_abc",
          transaction_vout: 0,
          node_left: { public_key: "02aaa" },
          node_right: { public_key: "03bbb" },
        }),
        { status: 200 },
      ),
    );
    const { getChannel } = await loadWithFetch(fetchMock as unknown as typeof fetch);
    const channel = await getChannel("859100x1234x0");
    expect(channel).toMatchObject({
      id: "840123456789",
      shortId: "859100x1234x0",
      capacity: 5_000_000,
      status: "active",
      transactionId: "tx_abc",
      transactionVout: 0,
      nodeLeftPub: "02aaa",
      nodeRightPub: "03bbb",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retourne null sur 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    const { getChannel } = await loadWithFetch(fetchMock as unknown as typeof fetch);
    const channel = await getChannel("999999x9999x9");
    expect(channel).toBeNull();
  });

  it("retourne null quand fetch jette (timeout, réseau)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    const { getChannel } = await loadWithFetch(fetchMock as unknown as typeof fetch);
    const channel = await getChannel("1x0x0");
    expect(channel).toBeNull();
  });

  it("jette si identifiant invalide", async () => {
    const { getChannel } = await loadWithFetch(vi.fn() as unknown as typeof fetch);
    await expect(getChannel("not-an-scid")).rejects.toThrow("Identifiant de channel");
  });

  it("tolère un payload partiel (pubkeys absentes)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "1",
          capacity: 100000,
          status: "closed",
        }),
        { status: 200 },
      ),
    );
    const { getChannel } = await loadWithFetch(fetchMock as unknown as typeof fetch);
    const channel = await getChannel("1x1x1");
    expect(channel).toMatchObject({
      id: "1",
      shortId: null,
      capacity: 100000,
      status: "closed",
      nodeLeftPub: null,
      nodeRightPub: null,
    });
  });
});
