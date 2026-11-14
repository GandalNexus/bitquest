import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { adminTeamMemberUpdateSchema, parseJsonBody } from "@/lib/validation/schemas";

/** PATCH /api/admin/team-members/[id] — met à jour un membre (ADMIN). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const existing = await db.teamMember.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Membre introuvable." }, { status: 404 });
  }

  const parsed = await parseJsonBody(req, adminTeamMemberUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const member = await db.teamMember.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.role !== undefined && { role: data.role }),
      ...(data.contribution !== undefined && { contribution: data.contribution }),
      ...(data.initials !== undefined && { initials: data.initials.toUpperCase() }),
      ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      ...(data.order !== undefined && { order: data.order }),
      ...(data.publishedAt !== undefined && {
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      }),
    },
  });

  await logAdminAction(guard.user.id, "TEAM_MEMBER_UPDATE", `team-member:${member.id}`, {
    name: member.name,
    changedFields: Object.keys(data),
  });

  return Response.json({ ok: true, member });
}

/** DELETE /api/admin/team-members/[id] — supprime un membre (ADMIN). */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const existing = await db.teamMember.findUnique({
    where: { id },
    select: { name: true, role: true },
  });
  if (!existing) {
    return Response.json({ error: "Membre introuvable." }, { status: 404 });
  }

  await db.teamMember.delete({ where: { id } });

  await logAdminAction(guard.user.id, "TEAM_MEMBER_DELETE", `team-member:${id}`, {
    name: existing.name,
    role: existing.role,
  });

  return Response.json({ ok: true });
}
