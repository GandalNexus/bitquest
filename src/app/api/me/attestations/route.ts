import { authenticate, unauthorized } from "@/lib/bitquest/session";
import { db } from "@/lib/db";

/**
 * GET /api/me/attestations — liste des Attestations de l'utilisateur
 * courant (LOT 26, suite LOT 25).
 *
 * Retour :
 *   { items: [{ id, kind, targetCode, targetTitle, metadata,
 *               issuedAt }] }
 *
 * - `kind` : "QUEST" | "COURSE" | "BADGE_EARNED" (seuls QUEST est
 *   écrit actuellement par les handlers, les autres sont réservés).
 * - `targetTitle` : titre enrichi via lookup secondaire (quête
 *   supprimée → fallback sur targetCode).
 * - `metadata` : JSON parsé (xpEarned, satsEarned, …) — null si
 *   payload malformé.
 *
 * Pas de rate-limit : endpoint lecture seule, scope user.
 */
export async function GET(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return unauthorized();

  const rows = await db.attestation.findMany({
    where: { userId: user.id },
    orderBy: { issuedAt: "desc" },
    take: 100,
    select: {
      id: true,
      kind: true,
      targetCode: true,
      metadata: true,
      issuedAt: true,
    },
  });

  // Lookup enrichi questTitle pour kind=QUEST (une seule requête
  // batch au lieu de N+1 — comme bitlab-stats).
  const questCodes = Array.from(
    new Set(rows.filter((r) => r.kind === "QUEST").map((r) => r.targetCode)),
  );
  const quests =
    questCodes.length > 0
      ? await db.quest.findMany({
          where: { code: { in: questCodes } },
          select: { code: true, title: true },
        })
      : [];
  const titleByCode = new Map(quests.map((q) => [q.code, q.title]));

  const items = rows.map((r) => {
    let metadata: Record<string, unknown> | null = null;
    try {
      const parsed = JSON.parse(r.metadata) as unknown;
      if (parsed && typeof parsed === "object") {
        metadata = parsed as Record<string, unknown>;
      }
    } catch {
      metadata = null;
    }
    return {
      id: r.id,
      kind: r.kind,
      targetCode: r.targetCode,
      targetTitle:
        r.kind === "QUEST"
          ? titleByCode.get(r.targetCode) ?? r.targetCode
          : r.targetCode,
      metadata,
      issuedAt: r.issuedAt.toISOString(),
    };
  });

  return Response.json({ items });
}
