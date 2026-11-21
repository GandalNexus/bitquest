/**
 * POST /api/admin/ai/drafts/[id]/reject — marque un brouillon comme REJECTED.
 */
import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { AIDraftRejectSchema } from "@/lib/ai/schemas";
import { parseJsonBody } from "@/lib/validation/schemas";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "EDITOR");
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const parsed = await parseJsonBody(req, AIDraftRejectSchema);
  if (!parsed.ok) return parsed.response;
  const reason = parsed.data.reason && parsed.data.reason.length > 0 ? parsed.data.reason : null;

  const draft = await db.aIDraft.findUnique({ where: { id } });
  if (!draft) return Response.json({ error: "Draft introuvable." }, { status: 404 });
  if (draft.status !== "PENDING") {
    return Response.json(
      { error: `Draft déjà traité (status=${draft.status}).` },
      { status: 409 },
    );
  }

  await db.aIDraft.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedBy: guard.user.id,
      rejectReason: reason,
    },
  });

  await logAdminAction(guard.user.id, "AI_DRAFT_REJECT", `ai_draft:${id}`, {
    reason,
  });

  return Response.json({ ok: true });
}
