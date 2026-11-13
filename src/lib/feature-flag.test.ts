import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  featureFlag: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { isFeatureEnabled } from "./feature-flag";

beforeEach(() => {
  dbMock.featureFlag.findUnique.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("isFeatureEnabled", () => {
  it("retourne defaultValue=false si le flag n'existe pas", async () => {
    dbMock.featureFlag.findUnique.mockResolvedValue(null);
    expect(await isFeatureEnabled("missing", "u1")).toBe(false);
  });

  it("retourne defaultValue=true explicite si le flag n'existe pas", async () => {
    dbMock.featureFlag.findUnique.mockResolvedValue(null);
    expect(await isFeatureEnabled("missing", "u1", true)).toBe(true);
  });

  it("retourne true si enabled=true globalement", async () => {
    dbMock.featureFlag.findUnique.mockResolvedValue({
      key: "academy.v2",
      description: "",
      enabled: true,
      userIds: "[]",
    });
    expect(await isFeatureEnabled("academy.v2", "u1")).toBe(true);
    expect(await isFeatureEnabled("academy.v2", null)).toBe(true);
  });

  it("retourne false si enabled=false et userId pas dans userIds", async () => {
    dbMock.featureFlag.findUnique.mockResolvedValue({
      key: "academy.v2",
      description: "",
      enabled: false,
      userIds: '["u-other"]',
    });
    expect(await isFeatureEnabled("academy.v2", "u1")).toBe(false);
  });

  it("retourne true si userId est dans userIds (canary)", async () => {
    dbMock.featureFlag.findUnique.mockResolvedValue({
      key: "academy.v2",
      description: "",
      enabled: false,
      userIds: '["u1","u2"]',
    });
    expect(await isFeatureEnabled("academy.v2", "u1")).toBe(true);
    expect(await isFeatureEnabled("academy.v2", "u2")).toBe(true);
    expect(await isFeatureEnabled("academy.v2", "u3")).toBe(false);
  });

  it("parse défensivement userIds malformé", async () => {
    dbMock.featureFlag.findUnique.mockResolvedValue({
      key: "x",
      description: "",
      enabled: false,
      userIds: "not-json",
    });
    expect(await isFeatureEnabled("x", "u1")).toBe(false);
  });

  it("ignore les valeurs non-string dans userIds", async () => {
    dbMock.featureFlag.findUnique.mockResolvedValue({
      key: "x",
      description: "",
      enabled: false,
      userIds: '["u1", 42, null]',
    });
    expect(await isFeatureEnabled("x", "u1")).toBe(true);
  });

  it("retourne defaultValue si Prisma throw", async () => {
    dbMock.featureFlag.findUnique.mockRejectedValue(new Error("db down"));
    expect(await isFeatureEnabled("x", "u1", false)).toBe(false);
    expect(await isFeatureEnabled("x", "u1", true)).toBe(true);
  });

  it("userId null et enabled=false → false", async () => {
    dbMock.featureFlag.findUnique.mockResolvedValue({
      key: "x",
      description: "",
      enabled: false,
      userIds: '["u1"]',
    });
    expect(await isFeatureEnabled("x", null)).toBe(false);
  });
});
