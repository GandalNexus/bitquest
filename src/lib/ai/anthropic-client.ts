/**
 * Client Anthropic partagé (lazy singleton).
 *
 * Lève une erreur claire si `ANTHROPIC_API_KEY` est absent plutôt que de
 * laisser le SDK retourner une 401 cryptique au premier call.
 */
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY manquant. Configure la variable d'environnement pour activer la génération IA.",
    );
  }
  client = new Anthropic({ apiKey });
  return client;
}

/**
 * Kill-switch global : la génération IA n'est active que si `AI_GENERATION_ENABLED=1`.
 * Sépare la décision produit (feature flag) de la décision ops (vraiment ouvrir
 * les paiements tokens). Pattern identique à `LND_SEND_REWARDS_LIVE`.
 */
export function isAIGenerationLive(): boolean {
  return process.env.AI_GENERATION_ENABLED === "1";
}

/** Modèle par défaut pour les générateurs de contenu. */
export const DEFAULT_GENERATION_MODEL = "claude-opus-4-7" as const;
