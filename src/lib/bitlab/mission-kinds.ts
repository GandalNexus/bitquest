/**
 * Mapping missionType (Quest.missionType) → BitLabProof.kind.
 *
 * Utilisé quand une quête est en missionKind=BITLAB_PROOF : l'UI et
 * l'endpoint de challenge doivent savoir quel type de preuve l'apprenant
 * est censé fournir (TX, BLOCK, …).
 */

export type BitlabKind = "TX" | "BLOCK" | "INVOICE" | "CHANNEL" | "ADDRESS";

const MISSION_TO_KIND: Record<string, BitlabKind> = {
  tx_builder: "TX",
  block_explorer: "BLOCK",
  lightning_pay: "INVOICE",
  channel_open: "CHANNEL",
  address_derive: "ADDRESS",
};

export function toBitlabKind(missionType: string): BitlabKind {
  return MISSION_TO_KIND[missionType] ?? "TX";
}

/** Réseaux supportés par /api/bitlab/proof. */
export const BITLAB_NETWORKS = ["testnet4", "signet", "regtest"] as const;
export type BitlabNetwork = (typeof BITLAB_NETWORKS)[number];

export function isBitlabNetwork(value: string): value is BitlabNetwork {
  return (BITLAB_NETWORKS as readonly string[]).includes(value);
}
