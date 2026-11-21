/**
 * GET /api/admin/ai/config — liste la config scheduler pour les 4 types.
 * POST /api/admin/ai/config — upsert la config d'un type.
 */
import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { requireRole } from "@/lib/auth/roles";
import { logAdminAction } from "@/lib/auth/audit";
import { DRAFT_TYPES } from "@/lib/ai/schemas";
import { AIConfigPostSchema } from "@/lib/ai/schemas";
import { parseJsonBody } from "@/lib/validation/schemas";

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

  const parsed = await parseJsonBody(req, AIConfigPostSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const enabled = body.enabled ?? false;
  const cadenceHours = body.cadenceHours ? Math.round(body.cadenceHours) : 24;
  const maxPerRun = body.maxPerRun ? Math.round(body.maxPerRun) : 1;
  const hint = typeof body.hint === "string" && body.hint.length > 0 ? body.hint : null;

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
