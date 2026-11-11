/**
 * Consommation atomique d'une preuve BitLab — Phase 3 hardening (P0.2).
 *
 * Problème : `/api/quests/[code]/progress` lisait puis mettait à jour
 * `bitLabProof.consumed`. Deux `mission_submit` concurrents pouvaient tous
 * deux voir la même preuve `consumed: false` et créditer les récompenses
 * deux fois (XP mission, bonus de complétion, sats, event QUEST_COMPLETED).
 *
 * Fix : lecture + updateMany conditionnel (`where: { id, consumed: false }`).
 * Le moteur SQL garantit qu'une seule des deux transactions voit count = 1 ;
 * les autres voient count = 0 et sont traitées comme DUPLICATE.
 *
 * API volontairement minimale (signature Prisma-compatible, pas de dépendance
 * dure au client Prisma) pour faciliter les tests unitaires avec mock.
 */

export interface BitLabProofRow {
  id: string;
  userId: string;
  questCode: string;
  kind: string;
  network: string;
  payload: string;
  verifiedAt: Date;
  consumed: boolean;
}

export interface BitLabProofDelegate {
  findFirst: (args: {
    where: { userId: string; questCode: string; consumed?: boolean };
    orderBy?: { verifiedAt: "desc" | "asc" };
  }) => Promise<BitLabProofRow | null>;
  updateMany: (args: {
    where: { id: string; consumed: false };
    data: { consumed: true };
  }) => Promise<{ count: number }>;
}

export type ConsumeBitlabProofResult =
  | { status: "CONSUMED"; proof: BitLabProofRow }
  | { status: "DUPLICATE"; existing: BitLabProofRow }
  | { status: "NO_PROOF" };

/**
 * Tente de consommer la preuve BitLab la plus récente (tous kinds confondus)
 * pour `(userId, questCode)`.
 *
 * - `CONSUMED` : preuve trouvée et marquée `consumed: true` dans cet appel.
 *   L'appelant peut créditer les récompenses.
 * - `DUPLICATE` : une preuve existe mais a déjà été consommée (par cet appel
 *   concurrent ou un précédent). L'appelant NE DOIT PAS créditer, et doit
 *   logger un audit outcome `DUPLICATE`.
 * - `NO_PROOF` : aucune preuve enregistrée pour cette quête. L'apprenant
 *   doit d'abord poster via `/api/bitlab/proof`.
 */
export async function consumeBitlabProof(
  bitLabProof: BitLabProofDelegate,
  userId: string,
  questCode: string,
): Promise<ConsumeBitlabProofResult> {
  const candidate = await bitLabProof.findFirst({
    where: { userId, questCode, consumed: false },
    orderBy: { verifiedAt: "desc" },
  });

  if (!candidate) {
    // Pas de candidat. Soit il n'y a jamais eu de preuve, soit toutes sont
    // consumed. On distingue pour que l'appelant puisse auditer DUPLICATE.
    const existing = await bitLabProof.findFirst({
      where: { userId, questCode },
      orderBy: { verifiedAt: "desc" },
    });
    if (existing) return { status: "DUPLICATE", existing };
    return { status: "NO_PROOF" };
  }

  const claim = await bitLabProof.updateMany({
    where: { id: candidate.id, consumed: false },
    data: { consumed: true },
  });

  if (claim.count === 0) {
    // Race : un autre appel concurrent a consommé la preuve entre le findFirst
    // et le updateMany. On la retourne quand même comme DUPLICATE pour que
    // l'audit soit possible, mais on NE crédite PAS.
    return { status: "DUPLICATE", existing: candidate };
  }

  return { status: "CONSUMED", proof: { ...candidate, consumed: true } };
}
