import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { adminPartnerCreateSchema, parseJsonBody } from "@/lib/validation/schemas";

/** POST /api/admin/partners — crée un sponsor/partenaire (ADMIN). */
export async function POST(req: Request) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const parsed = await parseJsonBody(req, adminPartnerCreateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const partner = await db.partner.create({
    data: {
      name: data.name,
      tier: data.tier,
      description: data.description,
      websiteUrl: data.websiteUrl ?? null,
      logoUrl: data.logoUrl ?? null,
      initials: data.initials.toUpperCase(),
      order: data.order,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
    },
  });

  await logAdminAction(guard.user.id, "PARTNER_CREATE", `partner:${partner.id}`, {
    name: partner.name,
    tier: partner.tier,
    published: partner.publishedAt !== null,
  });

  return Response.json({ ok: true, partner }, { status: 201 });
}
