/**
 * Validation des adresses Bitcoin côté BitQuest — P0.4.
 *
 * Deux niveaux de vérification sont supportés :
 *   - `FORMAT` : validation locale (préfixe réseau + charset + longueur).
 *     Pas d'appel réseau. Default lorsque aucun niveau n'est précisé dans
 *     la missionConfig de la quête.
 *   - `USED` : `FORMAT` + check mempool.space (l'adresse doit avoir reçu
 *     au moins une transaction). Requiert une connectivité explorateur.
 *
 * Volontairement sans full-checksum (bech32 / base58check) pour éviter
 * une dépendance lourde. Le préfixe + la longueur attrapent les
 * erreurs de saisie courantes ; les cas corner-case (checksum invalide
 * mais regex OK) sont rares et seront attrapés par le niveau `USED`.
 */

import type { Network } from "./mempool";

export const ADDRESS_VERIFY_LEVELS = ["FORMAT", "USED"] as const;
export type AddressVerifyLevel = (typeof ADDRESS_VERIFY_LEVELS)[number];

export const DEFAULT_ADDRESS_VERIFY_LEVEL: AddressVerifyLevel = "FORMAT";

/**
 * Patterns par réseau. On accepte :
 *   - bech32 (SegWit v0 P2WPKH / P2WSH + v1 Taproot P2TR)
 *   - base58 (P2PKH + P2SH)
 *
 * Longueur bech32 : 14-74 caractères (après le préfixe). P2WPKH ≈ 42,
 * P2WSH ≈ 62, P2TR ≈ 62. On est volontairement généreux pour couvrir
 * les variantes.
 */
interface AddressPattern {
  bech32: RegExp;
  base58: RegExp;
}

const ADDRESS_PATTERNS: Record<Exclude<Network, "mainnet">, AddressPattern> = {
  // Testnet4 et signet partagent les mêmes préfixes humain-lisibles.
  testnet4: {
    bech32: /^tb1[02-9ac-hj-np-z]{11,71}$/,
    base58: /^[mn2][1-9A-HJ-NP-Za-km-z]{25,39}$/,
  },
  signet: {
    bech32: /^tb1[02-9ac-hj-np-z]{11,71}$/,
    base58: /^[mn2][1-9A-HJ-NP-Za-km-z]{25,39}$/,
  },
  regtest: {
    bech32: /^bcrt1[02-9ac-hj-np-z]{11,71}$/,
    base58: /^[mn2][1-9A-HJ-NP-Za-km-z]{25,39}$/,
  },
};

export interface AddressFormatResult {
  valid: boolean;
  /** Format détecté quand valid=true. */
  format?: "bech32" | "base58";
  /** Message FR court quand valid=false. */
  reason?: string;
}

/**
 * Valide le format d'une adresse Bitcoin pour un réseau donné.
 * Mainnet est explicitement refusé (hors scope BitQuest v1).
 */
export function validateAddressFormat(network: Network, address: string): AddressFormatResult {
  if (network === "mainnet") {
    return { valid: false, reason: "mainnet n'est pas supporté sur BitQuest." };
  }
  const value = typeof address === "string" ? address.trim() : "";
  if (value.length === 0) {
    return { valid: false, reason: "Adresse vide." };
  }
  if (value.length > 100) {
    return { valid: false, reason: "Adresse trop longue (max 100 caractères)." };
  }
  const patterns = ADDRESS_PATTERNS[network];
  if (patterns.bech32.test(value)) {
    return { valid: true, format: "bech32" };
  }
  if (patterns.base58.test(value)) {
    return { valid: true, format: "base58" };
  }
  return {
    valid: false,
    reason: `Format d'adresse invalide pour ${network} (préfixes attendus : ${describeExpectedPrefixes(network)}).`,
  };
}

function describeExpectedPrefixes(network: Exclude<Network, "mainnet">): string {
  switch (network) {
    case "testnet4":
    case "signet":
      return "tb1… (bech32) ou m/n/2… (base58)";
    case "regtest":
      return "bcrt1… (bech32) ou m/n/2… (base58)";
  }
}

/**
 * Lit le niveau de vérification d'adresse attendu depuis la missionConfig
 * d'une quête. Robuste à un JSON invalide ou un champ absent.
 */
export function parseAddressVerifyLevel(missionConfigRaw: string | null | undefined): AddressVerifyLevel {
  if (!missionConfigRaw) return DEFAULT_ADDRESS_VERIFY_LEVEL;
  try {
    const parsed = JSON.parse(missionConfigRaw) as { addressVerifyLevel?: unknown };
    const level = parsed.addressVerifyLevel;
    if (typeof level === "string" && (ADDRESS_VERIFY_LEVELS as readonly string[]).includes(level)) {
      return level as AddressVerifyLevel;
    }
  } catch {
    // JSON invalide → fallback default silencieux (le reste du flow mission
    // a déjà sa propre gestion d'erreur sur missionConfig corrompu).
  }
  return DEFAULT_ADDRESS_VERIFY_LEVEL;
}
