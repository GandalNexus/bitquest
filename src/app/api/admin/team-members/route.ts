import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { adminTeamMemberCreateSchema, parseJsonBody } from "@/lib/validation/schemas";

/** POST /api/admin/team-members — crée un membre de l'équipe (ADMIN). */
export async function POST(req: Request) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const parsed = await parseJsonBody(req, adminTeamMemberCreateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const member = await db.teamMember.create({
    data: {
      name: data.name,
      role: data.role,
      contribution: data.contribution,
      initials: data.initials.toUpperCase(),
      avatarUrl: data.avatarUrl ?? null,
      order: data.order,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
    },
  });

  await logAdminAction(guard.user.id, "TEAM_MEMBER_CREATE", `team-member:${member.id}`, {
    name: member.name,
    role: member.role,
    published: member.publishedAt !== null,
  });

  return Response.json({ ok: true, member }, { status: 201 });
}
