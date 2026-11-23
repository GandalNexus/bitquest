import { clientIp, rateLimit } from "@/lib/bitquest/session";
import { verifySessionFromRequest } from "@/lib/auth/launch-token";
import { ACTIVE_STATES } from "@/lib/bitlab/attempt";
import { db } from "@/lib/db";

/**
 * GET /api/bitlab/me/attempts — endpoint cross-origin pour BitLab.
 *
 * Diffère de /api/me/bitlab-attempts :
 *   - Auth par Bearer `session_token` (émis au verify-launch-token),
 *     PAS par cookie/session BitQuest (impossible cross-origin).
 *   - CORS ouvert sur BITLAB_ALLOWED_ORIGINS (ou `*` en dev).
 *   - Strict read-only : aucune mutation ne doit transiter par ce token.
 *
 * Même shape de réponse que /api/me/bitlab-attempts pour faciliter la
 * réutilisation côté client BitLab.
 */

function allowedOrigins(): string[] {
  const raw = process.env.BITLAB_ALLOWED_ORIGINS?.trim();
  if (!raw) return ["*"];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(reqOrigin: string | null): Record<string, string> {
  const origins = allowedOrigins();
  const permissive = origins.includes("*");
  const allow = permissive ? reqOrigin ?? "*" : origins.find((o) => o === reqOrigin) ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
  if (allow) headers["Access-Control-Allow-Origin"] = allow;
  return headers;
}

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: Request) {
  const extraHeaders = corsHeaders(req.headers.get("origin"));

  if (!(await rateLimit(`bitlab-me-attempts-ip:${clientIp(req)}`, 120, 60_000))) {
    return Response.json(
      { error: "Trop de requêtes depuis cette IP." },
      { status: 429, headers: extraHeaders },
    );
  }

  const session = await verifySessionFromRequest(req);
  if (!session) {
    return Response.json(
      { error: "Session token invalide, absent ou expiré." },
      { status: 401, headers: extraHeaders },
    );
  }

  if (!(await rateLimit(`bitlab-me-attempts:${session.userId}`, 30, 60_000))) {
    return Response.json(
      { error: "Trop de requêtes, patiente une minute." },
      { status: 429, headers: extraHeaders },
    );
  }

  const url = new URL(req.url);
  const stateFilter = url.searchParams.get("state") ?? "all";
  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;

  const where: Record<string, unknown> = { userId: session.userId };
  if (stateFilter === "active") {
    where.state = { in: ACTIVE_STATES as unknown as string[] };
  }

  const rows = await db.missionAttempt.findMany({
    where,
    orderBy: { launchedAt: "desc" },
    take: limit,
  });

  const questCodes = Array.from(new Set(rows.map((r) => r.questCode)));
  const quests = questCodes.length
    ? await db.quest.findMany({
        where: { code: { in: questCodes } },
        select: { code: true, title: true },
      })
    : [];
  const titleByCode = new Map(quests.map((q) => [q.code, q.title]));

  return Response.json(
    {
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
    },
    { headers: extraHeaders },
  );
}
