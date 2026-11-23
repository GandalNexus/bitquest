import { describe, it, expect } from "vitest";
import { generateMission, validateMission } from "./missions";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function gen(type: string, config: Record<string, unknown> = {}) {
  return generateMission(type, config);
}

/* ------------------------------------------------------------------ */
/* generateMission — forme générale                                    */
/* ------------------------------------------------------------------ */

const ALL_TYPES = [
  "block_explorer",
  "key_forge",
  "tx_builder",
  "mine_nonce",
  "ln_channel",
  "ln_invoice",
  "multisig_sign",
  "taproot_tweak",
];

describe("generateMission", () => {
  it("retourne { challenge, expected } pour chaque type connu", () => {
    for (const t of ALL_TYPES) {
      const g = gen(t);
      expect(g).toHaveProperty("challenge");
      expect(g).toHaveProperty("expected");
      expect(typeof g.challenge).toBe("object");
      expect(typeof g.expected).toBe("object");
    }
  });

  it("fallback vers block_explorer pour un type inconnu", () => {
    const g = gen("whatever_unknown");
    const exp = g.expected as { txCount: number; hashSuffix: string };
    expect(typeof exp.txCount).toBe("number");
    expect(typeof exp.hashSuffix).toBe("string");
    expect(exp.hashSuffix).toHaveLength(6);
  });
});

/* ------------------------------------------------------------------ */
/* validateMission — refus par type inconnu / réponse malformée        */
/* ------------------------------------------------------------------ */

describe("validateMission — cas d'erreur transverses", () => {
  it("retourne success:false pour un type inconnu", () => {
    const result = validateMission(
      "unknown_type",
      { challenge: {}, expected: {} },
      {},
    );
    expect(result.success).toBe(false);
    expect(result.feedback).toMatch(/inconnu/i);
  });
});

/* ------------------------------------------------------------------ */
/* block_explorer                                                      */
/* ------------------------------------------------------------------ */

describe("mission block_explorer", () => {
  it("round-trip : réponse correcte → success + proof typé block", () => {
    const { challenge, expected } = gen("block_explorer");
    const exp = expected as { txCount: number; hashSuffix: string };
    const res = validateMission("block_explorer", { challenge, expected }, {
      txCount: exp.txCount,
      hashSuffix: exp.hashSuffix,
    });
    expect(res.success).toBe(true);
    expect(res.proof?.type).toBe("block");
  });

  it("rejette un mauvais txCount", () => {
    const { challenge, expected } = gen("block_explorer");
    const exp = expected as { txCount: number; hashSuffix: string };
    const res = validateMission("block_explorer", { challenge, expected }, {
      txCount: exp.txCount + 1,
      hashSuffix: exp.hashSuffix,
    });
    expect(res.success).toBe(false);
    expect(res.feedback).toMatch(/transactions/i);
  });

  it("rejette un hashSuffix erroné", () => {
    const { challenge, expected } = gen("block_explorer");
    const exp = expected as { txCount: number; hashSuffix: string };
    const res = validateMission("block_explorer", { challenge, expected }, {
      txCount: exp.txCount,
      hashSuffix: "wrong1",
    });
    expect(res.success).toBe(false);
    expect(res.feedback).toMatch(/suffixe/i);
  });

  it("normalise la casse du suffix", () => {
    const { challenge, expected } = gen("block_explorer");
    const exp = expected as { txCount: number; hashSuffix: string };
    const res = validateMission("block_explorer", { challenge, expected }, {
      txCount: exp.txCount,
      hashSuffix: exp.hashSuffix.toUpperCase(),
    });
    expect(res.success).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* key_forge                                                           */
/* ------------------------------------------------------------------ */

describe("mission key_forge", () => {
  it("round-trip : addressSuffix correct → success", () => {
    const { challenge, expected } = gen("key_forge");
    const exp = expected as { addressSuffix: string };
    const res = validateMission("key_forge", { challenge, expected }, {
      addressSuffix: exp.addressSuffix,
    });
    expect(res.success).toBe(true);
    expect(res.proof?.type).toBe("keys");
  });

  it("rejette un addressSuffix erroné", () => {
    const { challenge, expected } = gen("key_forge");
    const res = validateMission("key_forge", { challenge, expected }, {
      addressSuffix: "nope",
    });
    expect(res.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* tx_builder                                                          */
/* ------------------------------------------------------------------ */

describe("mission tx_builder — payment", () => {
  it("round-trip : tous les UTXO → change positif → success", () => {
    const { challenge, expected } = gen("tx_builder", { variant: "payment", target: 45000 });
    const exp = expected as {
      variant: string;
      utxoMap: Record<string, number>;
      target: number;
      feeSats: Record<string, number>;
    };
    const allIds = Object.keys(exp.utxoMap);
    const res = validateMission("tx_builder", { challenge, expected }, {
      selected: allIds,
      speed: "medium",
    });
    expect(res.success).toBe(true);
    expect(res.proof?.type).toBe("tx");
  });

  it("rejette une sélection vide", () => {
    const { challenge, expected } = gen("tx_builder", { variant: "payment" });
    const res = validateMission("tx_builder", { challenge, expected }, {
      selected: [],
      speed: "medium",
    });
    expect(res.success).toBe(false);
    expect(res.feedback).toMatch(/aucun utxo|input/i);
  });

  it("rejette un UTXO inconnu", () => {
    const { challenge, expected } = gen("tx_builder", { variant: "payment" });
    const res = validateMission("tx_builder", { challenge, expected }, {
      selected: ["ghost-utxo-id"],
      speed: "medium",
    });
    expect(res.success).toBe(false);
  });

  it("rejette un montant insuffisant", () => {
    const { challenge, expected } = gen("tx_builder", { variant: "payment", target: 1_000_000_000 });
    const exp = expected as { utxoMap: Record<string, number> };
    const firstId = Object.keys(exp.utxoMap)[0];
    const res = validateMission("tx_builder", { challenge, expected }, {
      selected: [firstId],
      speed: "medium",
    });
    expect(res.success).toBe(false);
    expect(res.feedback).toMatch(/insuffisant|manque/i);
  });
});

describe("mission tx_builder — consolidation", () => {
  it("round-trip : TOUS les UTXO → success", () => {
    const { challenge, expected } = gen("tx_builder", { variant: "consolidation" });
    const exp = expected as { utxoMap: Record<string, number> };
    const allIds = Object.keys(exp.utxoMap);
    const res = validateMission("tx_builder", { challenge, expected }, {
      selected: allIds,
      speed: "medium",
    });
    expect(res.success).toBe(true);
    expect(res.proof?.inputs).toBe(allIds.length);
  });

  it("rejette une consolidation partielle", () => {
    const { challenge, expected } = gen("tx_builder", { variant: "consolidation" });
    const exp = expected as { utxoMap: Record<string, number> };
    const [first] = Object.keys(exp.utxoMap);
    const res = validateMission("tx_builder", { challenge, expected }, {
      selected: [first],
      speed: "medium",
    });
    expect(res.success).toBe(false);
    expect(res.feedback).toMatch(/consolidation|tous/i);
  });
});

describe("mission tx_builder — fee_opt", () => {
  it("round-trip : speed=fast + bon totalFee → success", () => {
    const { challenge, expected } = gen("tx_builder", { variant: "fee_opt" });
    const exp = expected as { speed: string; totalFee: number };
    const res = validateMission("tx_builder", { challenge, expected }, {
      speed: exp.speed,
      totalFee: exp.totalFee,
    });
    expect(res.success).toBe(true);
    expect(res.proof?.type).toBe("tx");
  });

  it("rejette une mauvaise vitesse", () => {
    const { challenge, expected } = gen("tx_builder", { variant: "fee_opt" });
    const exp = expected as { totalFee: number };
    const res = validateMission("tx_builder", { challenge, expected }, {
      speed: "slow",
      totalFee: exp.totalFee,
    });
    expect(res.success).toBe(false);
    expect(res.feedback).toMatch(/vitesse|rapides/i);
  });

  it("rejette un totalFee incorrect", () => {
    const { challenge, expected } = gen("tx_builder", { variant: "fee_opt" });
    const res = validateMission("tx_builder", { challenge, expected }, {
      speed: "fast",
      totalFee: 1,
    });
    expect(res.success).toBe(false);
    expect(res.feedback).toMatch(/frais/i);
  });
});

/* ------------------------------------------------------------------ */
/* mine_nonce                                                          */
/* ------------------------------------------------------------------ */

describe("mission mine_nonce", () => {
  it("round-trip : nonce garanti → success", () => {
    const { challenge, expected } = gen("mine_nonce", { difficulty: "0", maxNonce: 10_000 });
    const exp = expected as { prefix: string; header: string; guaranteedNonce: number };
    expect(exp.guaranteedNonce).toBeGreaterThanOrEqual(0);
    const res = validateMission("mine_nonce", { challenge, expected }, {
      nonce: exp.guaranteedNonce,
    });
    expect(res.success).toBe(true);
    expect(res.proof?.type).toBe("block_mined");
  });

  it("rejette un nonce invalide (négatif)", () => {
    const { challenge, expected } = gen("mine_nonce");
    const res = validateMission("mine_nonce", { challenge, expected }, { nonce: -1 });
    expect(res.success).toBe(false);
  });

  it("rejette un nonce qui ne produit pas le bon préfixe", () => {
    const { challenge, expected } = gen("mine_nonce", { difficulty: "00000", maxNonce: 5 });
    const res = validateMission("mine_nonce", { challenge, expected }, { nonce: 999_999 });
    expect(res.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* ln_channel                                                          */
/* ------------------------------------------------------------------ */

describe("mission ln_channel", () => {
  it("round-trip : pair valide + capacité dans la fenêtre → success", () => {
    const { challenge, expected } = gen("ln_channel");
    const exp = expected as {
      myBalance: number;
      peers: { name: string; minCapacity: number; pubkey: string }[];
    };
    const peerIdx = 0;
    const capacity = Math.max(exp.peers[peerIdx].minCapacity, 20_000);
    const res = validateMission("ln_channel", { challenge, expected }, {
      peerIndex: peerIdx,
      capacity,
    });
    expect(res.success).toBe(true);
    expect(res.proof?.type).toBe("channel");
  });

  it("rejette un pair hors index", () => {
    const { challenge, expected } = gen("ln_channel");
    const res = validateMission("ln_channel", { challenge, expected }, {
      peerIndex: 99,
      capacity: 25_000,
    });
    expect(res.success).toBe(false);
  });

  it("rejette une capacité sous le dust limit (20 000 sats)", () => {
    const { challenge, expected } = gen("ln_channel");
    const res = validateMission("ln_channel", { challenge, expected }, {
      peerIndex: 0,
      capacity: 10_000,
    });
    expect(res.success).toBe(false);
    expect(res.feedback).toMatch(/dust|faible/i);
  });

  it("rejette une capacité supérieure au solde", () => {
    const { challenge, expected } = gen("ln_channel");
    const exp = expected as { myBalance: number };
    const res = validateMission("ln_channel", { challenge, expected }, {
      peerIndex: 0,
      capacity: exp.myBalance + 1,
    });
    expect(res.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* ln_invoice                                                          */
/* ------------------------------------------------------------------ */

describe("mission ln_invoice", () => {
  it("round-trip : montant + expiry corrects → success", () => {
    const { challenge, expected } = gen("ln_invoice", { amountSats: 5000, expiry: 3600 });
    const res = validateMission("ln_invoice", { challenge, expected }, {
      amount: 5000,
      expiry: 3600,
    });
    expect(res.success).toBe(true);
    expect(res.proof?.type).toBe("invoice");
  });

  it("rejette un montant incorrect", () => {
    const { challenge, expected } = gen("ln_invoice", { amountSats: 5000, expiry: 3600 });
    const res = validateMission("ln_invoice", { challenge, expected }, {
      amount: 1,
      expiry: 3600,
    });
    expect(res.success).toBe(false);
  });

  it("rejette une expiry incorrecte", () => {
    const { challenge, expected } = gen("ln_invoice", { amountSats: 5000, expiry: 3600 });
    const res = validateMission("ln_invoice", { challenge, expected }, {
      amount: 5000,
      expiry: 60,
    });
    expect(res.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* multisig_sign                                                       */
/* ------------------------------------------------------------------ */

describe("mission multisig_sign", () => {
  it("round-trip 2-of-3 : exactement 2 signataires valides → success", () => {
    const { challenge, expected } = gen("multisig_sign", { policy: "2-of-3" });
    const res = validateMission("multisig_sign", { challenge, expected }, {
      signers: [0, 1],
    });
    expect(res.success).toBe(true);
    expect(res.proof?.type).toBe("psbt");
  });

  it("rejette trop de signataires", () => {
    const { challenge, expected } = gen("multisig_sign", { policy: "2-of-3" });
    const res = validateMission("multisig_sign", { challenge, expected }, {
      signers: [0, 1, 2],
    });
    expect(res.success).toBe(false);
  });

  it("rejette des doublons (set.size != m)", () => {
    const { challenge, expected } = gen("multisig_sign", { policy: "2-of-3" });
    const res = validateMission("multisig_sign", { challenge, expected }, {
      signers: [0, 0],
    });
    expect(res.success).toBe(false);
  });

  it("rejette un index hors plage", () => {
    const { challenge, expected } = gen("multisig_sign", { policy: "2-of-3" });
    const res = validateMission("multisig_sign", { challenge, expected }, {
      signers: [0, 99],
    });
    expect(res.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* taproot_tweak                                                       */
/* ------------------------------------------------------------------ */

describe("mission taproot_tweak", () => {
  it("round-trip : choice correct + path=key → success", () => {
    const { challenge, expected } = gen("taproot_tweak");
    const exp = expected as { correctIdx: number; path: string };
    const res = validateMission("taproot_tweak", { challenge, expected }, {
      choice: exp.correctIdx,
      path: exp.path,
    });
    expect(res.success).toBe(true);
    expect(res.proof?.type).toBe("taproot");
    expect(res.proof?.witnessVersion).toBe(1);
  });

  it("rejette un choice erroné", () => {
    const { challenge, expected } = gen("taproot_tweak");
    const exp = expected as { correctIdx: number };
    const res = validateMission("taproot_tweak", { challenge, expected }, {
      choice: (exp.correctIdx + 1) % 3,
      path: "key",
    });
    expect(res.success).toBe(false);
  });

  it("rejette un path erroné (script au lieu de key)", () => {
    const { challenge, expected } = gen("taproot_tweak");
    const exp = expected as { correctIdx: number };
    const res = validateMission("taproot_tweak", { challenge, expected }, {
      choice: exp.correctIdx,
      path: "script",
    });
    expect(res.success).toBe(false);
  });
});
