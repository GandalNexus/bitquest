import { describe, it, expect } from "vitest";
import {
  CHANNEL_VERIFY_LEVELS,
  DEFAULT_CHANNEL_VERIFY_LEVEL,
  parseChannelVerifyLevel,
} from "./channel";

describe("parseChannelVerifyLevel", () => {
  it("retourne ONCHAIN par défaut quand missionConfig est vide/null", () => {
    expect(parseChannelVerifyLevel(null)).toBe("ONCHAIN");
    expect(parseChannelVerifyLevel(undefined)).toBe("ONCHAIN");
    expect(parseChannelVerifyLevel("")).toBe("ONCHAIN");
    expect(DEFAULT_CHANNEL_VERIFY_LEVEL).toBe("ONCHAIN");
  });

  it("lit DECLARATIVE depuis missionConfig JSON", () => {
    expect(parseChannelVerifyLevel('{"channelVerifyLevel":"DECLARATIVE"}')).toBe(
      "DECLARATIVE",
    );
  });

  it("lit ONCHAIN explicite", () => {
    expect(parseChannelVerifyLevel('{"channelVerifyLevel":"ONCHAIN"}')).toBe("ONCHAIN");
  });

  it("fallback ONCHAIN pour un niveau inconnu", () => {
    expect(parseChannelVerifyLevel('{"channelVerifyLevel":"MEMPOOL_ONLY"}')).toBe(
      "ONCHAIN",
    );
  });

  it("fallback ONCHAIN pour un JSON invalide", () => {
    expect(parseChannelVerifyLevel("not-json")).toBe("ONCHAIN");
  });

  it("expose les deux niveaux", () => {
    expect(CHANNEL_VERIFY_LEVELS).toEqual(["ONCHAIN", "DECLARATIVE"]);
  });
});
