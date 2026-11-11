import { authenticate, clientIp, rateLimit, unauthorized } from "@/lib/bitquest/session";
import { ACTIVE_STATES } from "@/lib/bitlab/attempt";
import { db } from "@/lib/db";

/**
 * GET /api/me/bitlab-attempts — liste les tentatives BitLab de l'utilisateur.
 *
 * Query params :
 *   - state=active : filtre sur états non-terminaux (reprise de mission).
 *   - state=all    : toutes les tentatives (défaut).
 *   - limit=1..50  : nombre max de résultats (défaut 20).
 *
 * Sert au dashboard BitQuest (reprise) et à l'espace « Mes missions » BitLab.
 */
export async function GET(req: Request) {
  if (!(await rateLimit(`bitlab-attempts-list-ip:${clientIp(req)}`, 120, 60_000))) {
    return Response.json({ error: "Trop de requêtes depuis cette IP." }, { status: 429 });
  }
  const user = await authenticate(req);
  if (!user) return unauthorized();
  if (!(await rateLimit(`bitlab-attempts-list:${user.id}`, 30, 60_000))) {
    return Response.json({ error: "Trop de requêtes, patiente une minute." }, { status: 429 });
  }

  const url = new URL(req.url);
  const stateFilter = url.searchParams.get("state") ?? "all";
  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 50)
    : 20;

  const where: Record<string, unknown> = { userId: user.id };
  if (stateFilter === "active") {
    where.state = { in: ACTIVE_STATES as unknown as string[] };
  }

  const rows = await db.missionAttempt.findMany({
    where,
    orderBy: { launchedAt: "desc" },
    take: limit,
  });

  // Enrichit avec le titre de la quête. Pas de FK ferme : si la quête a
  // été supprimée, fallback sur questCode.
  const questCodes = Array.from(new Set(rows.map((r) => r.questCode)));
  const quests = questCodes.length
    ? await db.quest.findMany({
        where: { code: { in: questCodes } },
        select: { code: true, title: true },
      })
    : [];
  const titleByCode = new Map(quests.map((q) => [q.code, q.title]));

  return Response.json({
    ok: true,
    attempts: rows.map((r) => {
      let result: unknown = null;
      if (r.resultJson) {
        try {
          result = JSON.parse(r.resultJson);
        } catch {
          result = null;
        }
      }
      return {
        id: r.id,
        questCode: r.questCode,
        questTitle: titleByCode.get(r.questCode) ?? r.questCode,
        kind: r.kind,
        network: r.network,
        state: r.state,
        launchedAt: r.launchedAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
        failedAt: r.failedAt?.toISOString() ?? null,
        failReason: r.failReason,
        proofId: r.proofId,
        result,
        returnTo: r.returnTo,
      };
    }),
  });
}
