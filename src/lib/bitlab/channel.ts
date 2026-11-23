/**
 * Niveaux de vérification CHANNEL pour `/api/bitlab/proof` — P2.4.
 *
 * Deux niveaux déclarés par quête via `missionConfig.channelVerifyLevel` :
 *
 *   - `ONCHAIN` (default) : lookup via LND REST (testnet4/signet/regtest)
 *     ou mempool.space (mainnet, hors scope v1). Vérification forte.
 *   - `DECLARATIVE` : l'apprenant saisit un scid valide (regex),
 *     aucun appel réseau. Utile pour les quêtes pédagogiques en testnet
 *     sans infra LND disponible. La preuve est marquée explicitement
 *     `verifyLevel: "DECLARATIVE"` pour la distinguer des preuves fortes.
 *
 * Ne JAMAIS utiliser `DECLARATIVE` pour une quête où l'on attribue des
 * récompenses réelles (sats). Réservé aux récompenses pédagogiques (XP).
 */

export const CHANNEL_VERIFY_LEVELS = ["ONCHAIN", "DECLARATIVE"] as const;
export type ChannelVerifyLevel = (typeof CHANNEL_VERIFY_LEVELS)[number];

export const DEFAULT_CHANNEL_VERIFY_LEVEL: ChannelVerifyLevel = "ONCHAIN";

/**
 * Lit le niveau de vérification channel attendu depuis la missionConfig.
 * Robuste à un JSON invalide ou un champ absent.
 */
export function parseChannelVerifyLevel(
  missionConfigRaw: string | null | undefined,
): ChannelVerifyLevel {
  if (!missionConfigRaw) return DEFAULT_CHANNEL_VERIFY_LEVEL;
  try {
    const parsed = JSON.parse(missionConfigRaw) as { channelVerifyLevel?: unknown };
    const level = parsed.channelVerifyLevel;
    if (
      typeof level === "string" &&
      (CHANNEL_VERIFY_LEVELS as readonly string[]).includes(level)
    ) {
      return level as ChannelVerifyLevel;
    }
  } catch {
    // JSON invalide → fallback default silencieux.
  }
  return DEFAULT_CHANNEL_VERIFY_LEVEL;
}
