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
  bitquestUrl: "https://www.bitquest.gandalnexus.xyz",
  bitlabUrl: "https://www.bitlab.gandalnexus.xyz",
  landingUrl: "https://www.gandalnexus.xyz",
  githubOrgUrl: "https://github.com/GandalNexus",
  verifyUrl: "https://www.bitquest.gandalnexus.xyz/verify",
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
  const raw = parsed.data;

  // Les champs optionnels validés comme chaîne (y compris "") sont convertis
  // en `null` avant persistance. La landing masque le slot UI quand c'est
  // null — pas de lien mort, pas de bouton vide.
  const data = {
    bitquestUrl: raw.bitquestUrl,
    bitlabUrl: raw.bitlabUrl,
    landingUrl: raw.landingUrl,
    githubOrgUrl: raw.githubOrgUrl,
    verifyUrl: raw.verifyUrl,
    contactEmail: raw.contactEmail.length > 0 ? raw.contactEmail : null,
    twitterUrl: raw.twitterUrl.length > 0 ? raw.twitterUrl : null,
    nostrPubkey: raw.nostrPubkey.length > 0 ? raw.nostrPubkey : null,
    docsUrl: raw.docsUrl.length > 0 ? raw.docsUrl : null,
  };

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
      landingUrl: config.landingUrl,
      githubOrgUrl: config.githubOrgUrl,
      verifyUrl: config.verifyUrl,
      contactEmail: config.contactEmail,
      twitterUrl: config.twitterUrl,
      nostrPubkey: config.nostrPubkey,
      docsUrl: config.docsUrl,
    },
  );

  return Response.json({ ok: true, config });
}
