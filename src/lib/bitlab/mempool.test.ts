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
  return import("./mempool");
}

describe("MempoolClient.getTransaction", () => {
  it("retourne les champs normalisés quand mempool.space répond", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          txid: "abc",
          status: { confirmed: true, block_height: 100, block_hash: "bh" },
          fee: 1234,
          size: 250,
          vout: [{ scriptpubkey_address: "addr", value: 50000 }],
        }),
        { status: 200 },
      ),
    );
    const { getTransaction } = await loadWithFetch(fetchMock as unknown as typeof fetch);
    const tx = await getTransaction("testnet4", "abc");
    expect(tx).toMatchObject({
      txid: "abc",
      confirmed: true,
      blockHeight: 100,
      blockHash: "bh",
      feeSats: 1234,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tombe sur le fallback blockstream quand mempool.space jette", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            txid: "abc",
            status: { confirmed: false },
            fee: 0,
            size: 100,
            vout: [],
          }),
          { status: 200 },
        ),
      );
    const { getTransaction } = await loadWithFetch(fetchMock as unknown as typeof fetch);
    const tx = await getTransaction("testnet4", "abc");
    expect(tx?.confirmed).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retourne null si les deux explorateurs échouent", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(new Response("", { status: 404 }));
    const { getTransaction } = await loadWithFetch(fetchMock as unknown as typeof fetch);
    const tx = await getTransaction("testnet4", "notfound");
    expect(tx).toBeNull();
  });

  it("refuse explicitement mainnet", async () => {
    const { getTransaction } = await loadWithFetch(vi.fn() as unknown as typeof fetch);
    await expect(getTransaction("mainnet", "abc")).rejects.toThrow("mainnet");
  });
});

describe("MempoolClient.getBlock", () => {
  it("retourne height et tx_count normalisés", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "h",
          height: 42,
          timestamp: 1700000000,
          tx_count: 123,
          extras: { pool: { name: "AntPool" } },
        }),
        { status: 200 },
      ),
    );
    const { getBlock } = await loadWithFetch(fetchMock as unknown as typeof fetch);
    const b = await getBlock("testnet4", "h");
    expect(b).toMatchObject({ id: "h", height: 42, tx_count: 123, miner: "AntPool" });
  });

  it("refuse mainnet", async () => {
    const { getBlock } = await loadWithFetch(vi.fn() as unknown as typeof fetch);
    await expect(getBlock("mainnet", "h")).rejects.toThrow("mainnet");
  });
});
