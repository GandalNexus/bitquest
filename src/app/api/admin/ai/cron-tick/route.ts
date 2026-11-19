/**
 * POST /api/admin/ai/cron-tick — déclenche un tick du scheduler IA.
 *
 * Deux voies d'appel :
 *   - Interne (Vercel Cron / node-cron) : header `x-cron-secret` doit matcher
 *     `AI_CRON_SECRET` (var env). Pas d'auth utilisateur nécessaire.
 *   - Admin manuel : si le header est absent, retombe sur `requireRoleAndCsrf`
 *     EDITOR+ pour autoriser un trigger depuis l'UI admin.
 */
import { requireRoleAndCsrf } from "@/lib/auth/guard";
import { runSchedulerTick } from "@/lib/ai/scheduler";
import { logger } from "@/lib/log";

const log = logger("ai-cron");

export async function POST(req: Request) {
  const secretHeader = req.headers.get("x-cron-secret");
  const expected = process.env.AI_CRON_SECRET?.trim();

  if (secretHeader) {
    if (!expected || secretHeader !== expected) {
      return Response.json({ error: "Secret cron invalide." }, { status: 401 });
    }
  } else {
    const guard = await requireRoleAndCsrf(req, "EDITOR");
    if (!guard.ok) return guard.response;
  }

  const result = await runSchedulerTick();
  log.info({ result }, "AI scheduler tick executed");
  return Response.json(result);
}
