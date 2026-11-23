import { describe, it, expect } from "vitest";
import { dailyChallengesSeed, offsetIsoDay } from "./challenges-seed";

describe("offsetIsoDay", () => {
  it("retourne la même date pour offset=0", () => {
    expect(offsetIsoDay("2026-11-10", 0)).toBe("2026-11-10");
  });

  it("avance de N jours UTC", () => {
    expect(offsetIsoDay("2026-11-10", 1)).toBe("2026-11-11");
    expect(offsetIsoDay("2026-11-10", 7)).toBe("2026-11-17");
  });

  it("supporte offsets négatifs", () => {
    expect(offsetIsoDay("2026-11-10", -1)).toBe("2026-11-09");
  });

  it("franchit les fins de mois", () => {
    expect(offsetIsoDay("2026-01-31", 1)).toBe("2026-02-01");
    expect(offsetIsoDay("2024-02-28", 1)).toBe("2024-02-29"); // année bissextile
  });

  it("franchit les fins d'année", () => {
    expect(offsetIsoDay("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("dailyChallengesSeed", () => {
  it("expose 7 défis (fenêtre glissante d'une semaine)", () => {
    expect(dailyChallengesSeed).toHaveLength(7);
  });

  it("couvre les offsets 0..6 exactement une fois", () => {
    const offsets = dailyChallengesSeed.map((c) => c.dayOffset).sort((a, b) => a - b);
    expect(offsets).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("chaque défi a un title, un prompt, et des récompenses > 0", () => {
    for (const c of dailyChallengesSeed) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.prompt.length).toBeGreaterThan(20);
      expect(c.xpReward).toBeGreaterThan(0);
      expect(c.satsReward).toBeGreaterThan(0);
    }
  });
});
