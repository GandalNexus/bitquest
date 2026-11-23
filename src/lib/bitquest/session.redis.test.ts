/**
 * Tests du chemin Redis de rateLimit() — Phase 1.4.
 *
 * On mocke @/lib/cache/redis pour piloter l'état "Redis dispo" ou
 * "Redis indisponible / timeout" sans démarrer d'infrastructure réelle.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const incrMock = vi.fn();
const pexpireMock = vi.fn();
const getRedisMock: ReturnType<typeof vi.fn> = vi.fn();

vi.mock("@/lib/cache/redis", () => ({
  getRedis: () => getRedisMock(),
}));

import { rateLimit } from "./session";

const fakeRedis = { incr: incrMock, pexpire: pexpireMock };

beforeEach(() => {
  incrMock.mockReset();
  pexpireMock.mockReset();
  getRedisMock.mockReset();
});

describe("rateLimit — chemin Redis", () => {
  it("autorise tant que INCR ≤ max, pose EXPIRE sur le premier hit", async () => {
    getRedisMock.mockResolvedValue(fakeRedis);
    incrMock.mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    pexpireMock.mockResolvedValue(1);

    expect(await rateLimit("k", 3, 60_000)).toBe(true);
    expect(pexpireMock).toHaveBeenCalledWith("rl:k", 60_000);
    expect(await rateLimit("k", 3, 60_000)).toBe(true);
    expect(await rateLimit("k", 3, 60_000)).toBe(true);
    // Un seul pexpire sur le premier hit
    expect(pexpireMock).toHaveBeenCalledTimes(1);
  });

  it("refuse quand INCR dépasse max", async () => {
    getRedisMock.mockResolvedValue(fakeRedis);
    incrMock.mockResolvedValueOnce(4);
    expect(await rateLimit("k", 3, 60_000)).toBe(false);
  });

  it("préfixe les clés avec rl:", async () => {
    getRedisMock.mockResolvedValue(fakeRedis);
    incrMock.mockResolvedValueOnce(1);
    pexpireMock.mockResolvedValue(1);
    await rateLimit("my-key", 5, 1000);
    expect(incrMock).toHaveBeenCalledWith("rl:my-key");
  });

  it("retombe sur in-memory si getRedis() retourne null", async () => {
    getRedisMock.mockResolvedValue(null);
    // Première passe : la clé est vierge, doit passer
    const key = `fb:${Math.random()}`;
    expect(await rateLimit(key, 1, 1000)).toBe(true);
    expect(incrMock).not.toHaveBeenCalled();
    // Deuxième passe : max=1 atteint
    expect(await rateLimit(key, 1, 1000)).toBe(false);
  });

  it("retombe sur in-memory si INCR jette (résilience)", async () => {
    getRedisMock.mockResolvedValue(fakeRedis);
    incrMock.mockRejectedValueOnce(new Error("timeout"));
    const key = `err:${Math.random()}`;
    expect(await rateLimit(key, 1, 1000)).toBe(true);
    // Le fallback in-memory s'applique : deuxième appel sur même clé refusé
    incrMock.mockRejectedValueOnce(new Error("timeout"));
    expect(await rateLimit(key, 1, 1000)).toBe(false);
  });
});
