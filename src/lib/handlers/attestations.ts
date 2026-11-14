import { db } from "@/lib/db";
import { logger } from "@/lib/log";
import { on } from "@/lib/event-bus";

const log = logger("attestations");

/**
 * Handler event-bus : crée automatiquement une `Attestation` immuable
 * dès qu'une quête est complétée (payload `quest.completed`). P3
 * schema LOT 11 T4.
 *
 * Idempotent via la contrainte `@@unique([userId, kind, targetCode])`
 * du modèle : si l'attestation existe déjà, Prisma lève P2002 → on
 * log silencieusement et renvoie 0 côté handler (manifesto : jamais
 * bloquer le flux principal).
 *
 * Métadonnées persistées :
 *   { xpEarned, satsEarned, questCode, issuedAtEpoch }
 *
 * Le module nostr/NIP arrivera plus tard, l'Attestation est le socle.
 */

interface QuestCompletedPayload {
  userId: string;
  questCode: string;
  xpEarned: number;
  satsEarned: number;
}

async function createQuestAttestation(payload: QuestCompletedPayload): Promise<string | null> {
  try {
    const attestation = await db.attestation.create({
      data: {
        userId: payload.userId,
        kind: "QUEST",
        targetCode: payload.questCode,
        metadata: JSON.stringify({
          xpEarned: payload.xpEarned,
          satsEarned: payload.satsEarned,
          questCode: payload.questCode,
          issuedAtEpoch: Date.now(),
        }),
      },
    });
    log.info(
      { userId: payload.userId, questCode: payload.questCode, attestationId: attestation.id },
      "attestation QUEST créée",
    );
    return attestation.id;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2002") {
      // Unique violation = replay, comportement attendu (idempotent).
      log.info(
        { userId: payload.userId, questCode: payload.questCode },
        "attestation QUEST déjà existante — idempotent",
      );
      return null;
    }
    log.warn(
      {
        userId: payload.userId,
        questCode: payload.questCode,
        err: err instanceof Error ? err.message : String(err),
      },
      "création attestation QUEST échouée (ignorée)",
    );
    return null;
  }
}

/** Branche le handler sur event-bus. Appelée au boot. Idempotente. */
let registered = false;
export function registerAttestationHandlers(): void {
  if (registered) return;
  // Wrap pour satisfaire le type Handler<"quest.completed"> qui veut
  // `Promise<void>` — on perd juste l'id retourné (seuls les tests le
  // consomment directement via createQuestAttestation).
  on("quest.completed", async (payload) => {
    await createQuestAttestation(payload);
  });
  registered = true;
  log.info("handler attestations monté sur event-bus");
}

/** Export direct pour tests unitaires (sans brancher event-bus). */
export { createQuestAttestation };
