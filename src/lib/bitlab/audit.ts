import { db } from "@/lib/db";
import { logger } from "@/lib/log";

const log = logger("bitlab-audit");

/**
 * Journal d'audit des tentatives /api/bitlab/proof.
 *
 * Chaque appel au handler produit exactement une entrée (succès ou refus).
 * Les écritures sont fire-and-forget : si la base échoue (ex. table pas
 * encore migrée), on logge un warn et on continue — pas question de
 * casser le flux utilisateur à cause d'un audit.
 */

export type ProofOutcome =
  | "ACCEPTED"
  | "REJECTED"
  | "NOT_FOUND"
  | "UNAVAILABLE"
  | "INVALID_JWT"
  | "MEMPOOL"
  | "BAD_REQUEST"
  | "RATE_LIMITED"
  /**
   * Tentative de double consommation d'une preuve déjà `consumed: true`.
   * Émis depuis `/api/quests/[code]/progress` lorsqu'un `mission_submit`
   * est répété alors que les récompenses ont déjà été attribuées.
   */
  | "DUPLICATE";

export interface RecordProofAttemptInput {
  userId: string;
  questCode: string;
  kind: string;
  network: string;
  outcome: ProofOutcome;
  reasonMessage?: string | null;
  startedAt: number; // Date.now() au début du handler
}

export async function recordProofAttempt(input: RecordProofAttemptInput): Promise<void> {
  try {
    await db.bitLabProofAttempt.create({
      data: {
        userId: input.userId,
        questCode: input.questCode,
        kind: input.kind,
        network: input.network,
        outcome: input.outcome,
        reasonMessage: input.reasonMessage ?? null,
        latencyMs: Math.max(0, Date.now() - input.startedAt),
      },
    });
  } catch (err) {
    log.warn(
      {
        err: err instanceof Error ? err.message : String(err),
        userId: input.userId,
        questCode: input.questCode,
        outcome: input.outcome,
      },
      "audit record failed (continuing)",
    );
  }
}

/**
 * Version synchrone fire-and-forget : utilisée dans les handlers HTTP
 * pour ne pas bloquer la réponse sur l'écriture d'audit. L'erreur
 * éventuelle est loggée via recordProofAttempt (déjà capturée là).
 */
export function fireProofAttempt(input: RecordProofAttemptInput): void {
  void recordProofAttempt(input);
}
