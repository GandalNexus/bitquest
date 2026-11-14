import { z } from "zod";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { parseJsonBody } from "@/lib/validation/schemas";
import { sendReward } from "@/lib/lightning/rewards";
import { isFeatureEnabled } from "@/lib/feature-flag";

/**
 * POST /api/me/lightning-reward — apprenant demande un paiement Lightning
 * réel vers une invoice qu'il fournit (P4).
 *
 * Gardes empilées :
 *   1. Authentifié (APPRENTICE+) + CSRF si session cookie.
 *   2. Feature flag `lightning.rewards` actif pour ce user.
 *   3. `sendReward()` applique ses propres gardes (bolt11 non-mainnet,
 *      plafond, LND configuré, kill-switch `LND_SEND_REWARDS_LIVE=1`).
 *
 * ⚠️ On ne décrémente PAS `User.sats` (simulés) après un paiement réel.
 * Les deux comptabilités restent strictement séparées (manifesto). La
 * conversion simulé→réel n'est **pas** 1:1 ; elle sera toujours
 * conditionnée à une politique opérationnelle décidée côté ops
 * (budget testnet, plafond quotidien, etc.).
 */

const bodySchema = z.object({
  invoiceBolt11: z
    .string()
    .trim()
    .min(50, "Invoice trop courte.")
    .max(2048, "Invoice trop longue.")
    .regex(/^ln[a-z0-9]+$/i, "Format d'invoice BOLT11 invalide."),
});

export async function POST(req: Request) {
  const guard = await requireRoleAndCsrf(req, "APPRENTICE");
  if (!guard.ok) return guard.response;

  const parsed = await parseJsonBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;

  // Garde flag en amont (meilleur message d'erreur qu'un `FLAG_DISABLED`
  // générique renvoyé par sendReward).
  const flagOn = await isFeatureEnabled("lightning.rewards", guard.user.id);
  if (!flagOn) {
    return Response.json(
      {
        error:
          "Les récompenses Lightning ne sont pas encore activées pour ton compte. Reviens quand le programme sera ouvert.",
      },
      { status: 403 },
    );
  }

  const result = await sendReward({
    userId: guard.user.id,
    invoiceBolt11: parsed.data.invoiceBolt11,
    context: { source: "self_redeem" },
  });

  const httpStatus = result.status === "PAID" ? 200 : 400;
  return Response.json(
    {
      status: result.status,
      rewardId: result.rewardId,
      amountMsat: result.amountMsat,
      feeMsat: result.feeMsat,
      preimageHex: result.preimageHex,
      failureReason: result.failureReason,
    },
    { status: httpStatus },
  );
}
