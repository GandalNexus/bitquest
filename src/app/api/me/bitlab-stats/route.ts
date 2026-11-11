import { authenticate, unauthorized } from "@/lib/bitquest/session";
import { db } from "@/lib/db";

/**
 * GET /api/me/bitlab-stats — stats d'activité BitLab de l'utilisateur
 * courant pour la tuile "Missions pratiques" du dashboard (I4).
 *
 * Retourne :
 *   - proofCount : nombre total de preuves BitLab vérifiées
 *   - consumedCount : subset ayant donné lieu à une récompense (quête
 *     complétée)
 *   - lastProof : la plus récente preuve enrichie du titre de la quête
 *     (ou null si l'user n'en a jamais soumis)
 *
 * Pas de rate-limit dédié : endpoint lecture-seule et scope user.
 * Le pattern suit la convention `/api/me/*` déjà en place.
 */
export async function GET(req: Request) {
  const user = await authenticate(req);
  if (!user) return unauthorized();

  const [proofCount, consumedCount, lastProof] = await Promise.all([
    db.bitLabProof.count({ where: { userId: user.id } }),
    db.bitLabProof.count({ where: { userId: user.id, consumed: true } }),
    db.bitLabProof.findFirst({
      where: { userId: user.id },
      orderBy: { verifiedAt: "desc" },
      select: {
        questCode: true,
        kind: true,
        network: true,
        verifiedAt: true,
        consumed: true,
      },
    }),
  ]);

  // Pas de FK entre BitLabProof.questCode et Quest.code — on fait un
  // lookup secondaire si une dernière preuve existe. Si la quête a
  // été supprimée côté admin, on garde le questCode brut comme titre.
  let lastProofEnriched: {
    questCode: string;
    questTitle: string;
    kind: string;
    network: string;
    verifiedAt: string;
    consumed: boolean;
  } | null = null;
  if (lastProof) {
    const quest = await db.quest.findUnique({
      where: { code: lastProof.questCode },
      select: { title: true },
    });
    lastProofEnriched = {
      questCode: lastProof.questCode,
      questTitle: quest?.title ?? lastProof.questCode,
      kind: lastProof.kind,
      network: lastProof.network,
      verifiedAt: lastProof.verifiedAt.toISOString(),
      consumed: lastProof.consumed,
    };
  }

  return Response.json({
    proofCount,
    consumedCount,
    lastProof: lastProofEnriched,
  });
}
