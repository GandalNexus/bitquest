/**
 * Tests /api/version — LOT 44.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "./route";

let originalVersion: string | undefined;
let originalCommit: string | undefined;
let originalHost: string | undefined;
let originalBuiltAt: string | undefined;

beforeEach(() => {
  originalVersion = process.env.npm_package_version;
  originalCommit = process.env.BITQUEST_COMMIT_SHA;
  originalHost = process.env.NEXT_PUBLIC_BITQUEST_HOST;
  originalBuiltAt = process.env.BITQUEST_BUILT_AT;
});

afterEach(() => {
  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) delete (process.env as Record<string, string | undefined>)[key];
    else process.env[key] = value;
  };
  restore("npm_package_version", originalVersion);
  restore("BITQUEST_COMMIT_SHA", originalCommit);
  restore("NEXT_PUBLIC_BITQUEST_HOST", originalHost);
  restore("BITQUEST_BUILT_AT", originalBuiltAt);
});

describe("GET /api/version", () => {
  it("renvoie 200 avec les 6 champs attendus", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("protocolVersion");
    expect(body).toHaveProperty("certificateVersion");
    expect(body).toHaveProperty("release");
    expect(body).toHaveProperty("commitHash");
    expect(body).toHaveProperty("issuer");
    expect(body).toHaveProperty("builtAt");
  });

  it("protocolVersion = 1", async () => {
    const res = GET();
    const body = (await res.json()) as { protocolVersion: number };
    expect(body.protocolVersion).toBe(1);
  });

  it("certificateVersion = 1", async () => {
    const res = GET();
    const body = (await res.json()) as { certificateVersion: number };
    expect(body.certificateVersion).toBe(1);
  });

  it("release reprend npm_package_version", async () => {
    process.env.npm_package_version = "0.4.2";
    const res = GET();
    const body = (await res.json()) as { release: string };
    expect(body.release).toBe("0.4.2");
  });

  it("commitHash null si BITQUEST_COMMIT_SHA absent", async () => {
    delete process.env.BITQUEST_COMMIT_SHA;
    const res = GET();
    const body = (await res.json()) as { commitHash: string | null };
    expect(body.commitHash).toBeNull();
  });

  it("commitHash reflète BITQUEST_COMMIT_SHA", async () => {
    process.env.BITQUEST_COMMIT_SHA = "abc123def456";
    const res = GET();
    const body = (await res.json()) as { commitHash: string };
    expect(body.commitHash).toBe("abc123def456");
  });

  it("issuer fallback 'bitquest.local' si NEXT_PUBLIC_BITQUEST_HOST absent", async () => {
    delete process.env.NEXT_PUBLIC_BITQUEST_HOST;
    const res = GET();
    const body = (await res.json()) as { issuer: string };
    expect(body.issuer).toBe("bitquest.local");
  });

  it("headers X-Protocol-Version et X-Certificate-Version présents", () => {
    const res = GET();
    expect(res.headers.get("X-Protocol-Version")).toBe("1");
    expect(res.headers.get("X-Certificate-Version")).toBe("1");
  });
});
