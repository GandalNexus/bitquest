import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { logAdminAction } from "@/lib/auth/audit";
import { adminPartnerUpdateSchema, parseJsonBody } from "@/lib/validation/schemas";

/** PATCH /api/admin/partners/[id] — met à jour un partenaire (ADMIN). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const existing = await db.partner.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Partenaire introuvable." }, { status: 404 });
  }

  const parsed = await parseJsonBody(req, adminPartnerUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const partner = await db.partner.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.tier !== undefined && { tier: data.tier }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.websiteUrl !== undefined && { websiteUrl: data.websiteUrl }),
      ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
      ...(data.initials !== undefined && { initials: data.initials.toUpperCase() }),
      ...(data.order !== undefined && { order: data.order }),
      ...(data.publishedAt !== undefined && {
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      }),
    },
  });

  await logAdminAction(guard.user.id, "PARTNER_UPDATE", `partner:${partner.id}`, {
    name: partner.name,
    changedFields: Object.keys(data),
  });

  return Response.json({ ok: true, partner });
}

/** DELETE /api/admin/partners/[id] — supprime un partenaire (ADMIN). */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const existing = await db.partner.findUnique({
    where: { id },
    select: { name: true, tier: true },
  });
  if (!existing) {
    return Response.json({ error: "Partenaire introuvable." }, { status: 404 });
  }

  await db.partner.delete({ where: { id } });

  await logAdminAction(guard.user.id, "PARTNER_DELETE", `partner:${id}`, {
    name: existing.name,
    tier: existing.tier,
  });

  return Response.json({ ok: true });
}
