import { db } from "@/lib/db";
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { requireRole } from "@/lib/auth/roles";
import { logAdminAction } from "@/lib/auth/audit";
import {
  adminLandingConfigUpdateSchema,
  parseJsonBody,
} from "@/lib/validation/schemas";

const SINGLETON_ID = "singleton";

const DEFAULTS = {
  bitquestUrl: "https://bitquest.gandalnexus.com",
  bitlabUrl: "https://bitlab.gandalnexus.com",
  githubOrgUrl: "https://github.com/GandalNexus",
  verifyUrl: "https://bitquest.gandalnexus.com/verify",
};

/** GET /api/admin/landing-config — lit la config landing (ADMIN). */
export async function GET(req: Request) {
  const auth = await requireRole(req, "ADMIN");
  if (!auth.ok) return auth.response;

  const row = await db.landingConfig.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...DEFAULTS },
    update: {},
  });

  return Response.json({ ok: true, config: row });
}

/** PATCH /api/admin/landing-config — met à jour la config landing (ADMIN + CSRF). */
export async function PATCH(req: Request) {
  const guard = await requireRoleAndCsrf(req, "ADMIN");
  if (!guard.ok) return guard.response;

  const parsed = await parseJsonBody(req, adminLandingConfigUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  const config = await db.landingConfig.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data, updatedBy: guard.user.id },
    update: { ...data, updatedBy: guard.user.id },
  });

  await logAdminAction(
    guard.user.id,
    "LANDING_CONFIG_UPDATE",
    `landing-config:${SINGLETON_ID}`,
    {
      bitquestUrl: config.bitquestUrl,
      bitlabUrl: config.bitlabUrl,
      githubOrgUrl: config.githubOrgUrl,
      verifyUrl: config.verifyUrl,
    },
  );

  return Response.json({ ok: true, config });
}
