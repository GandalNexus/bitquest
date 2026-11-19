/**
 * GET /api/admin/ai/config — liste la config scheduler pour les 4 types.
 * POST /api/admin/ai/config — upsert la config d'un type.
 */
import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { requireRole } from "@/lib/auth/roles";
import { logAdminAction } from "@/lib/auth/audit";
import { DRAFT_TYPES, isDraftType } from "@/lib/ai/schemas";

export async function GET(req: Request) {
  // GET read-only — pas de CSRF.
  const guard = await requireRole(req, "EDITOR");
  if (!guard.ok) return guard.response;

  const rows = await db.aIGenerationConfig.findMany();
  const byType = new Map(rows.map((r) => [r.type, r]));
  const full = DRAFT_TYPES.map(
    (type) =>
      byType.get(type) ?? {
        type,
        enabled: false,
        cadenceHours: 24,
        maxPerRun: 1,
        hint: null,
        lastRunAt: null,
        lastError: null,
        updatedAt: new Date(0),
      },
  );
  return Response.json({ configs: full });
}

export async function POST(req: Request) {
  const guard = await requireRoleAndCsrf(req, "EDITOR");
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => ({}))) as {
    type?: unknown;
    enabled?: unknown;
    cadenceHours?: unknown;
    maxPerRun?: unknown;
    hint?: unknown;
  };

  if (!isDraftType(body.type)) {
    return Response.json({ error: "Type invalide." }, { status: 400 });
  }
  const enabled = typeof body.enabled === "boolean" ? body.enabled : false;
  const cadenceHours =
    typeof body.cadenceHours === "number" && body.cadenceHours >= 1 && body.cadenceHours <= 24 * 30
      ? Math.round(body.cadenceHours)
      : 24;
  const maxPerRun =
    typeof body.maxPerRun === "number" && body.maxPerRun >= 1 && body.maxPerRun <= 5
      ? Math.round(body.maxPerRun)
      : 1;
  const hint =
    typeof body.hint === "string" && body.hint.trim().length > 0 && body.hint.length <= 500
      ? body.hint.trim()
      : null;

  const saved = await db.aIGenerationConfig.upsert({
    where: { type: body.type },
    create: { type: body.type, enabled, cadenceHours, maxPerRun, hint },
    update: { enabled, cadenceHours, maxPerRun, hint },
  });

  await logAdminAction(guard.user.id, "AI_CONFIG_UPDATE", `ai_config:${body.type}`, {
    enabled,
    cadenceHours,
    maxPerRun,
  });

  return Response.json({ ok: true, config: saved });
}
