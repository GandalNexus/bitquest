import { getHealthStatus } from "@/lib/health";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — endpoint public (pas d'auth).
 *
 * 200 si status === "ok" | "degraded" (service up),
 * 503 si status === "down" (DB inaccessible).
 *
 * Utilisable par :
 *   - Load balancer / orchestrateur (Kubernetes readiness / liveness)
 *   - Status page / monitoring externe
 *   - Page admin /admin/health
 */
export async function GET() {
  const report = await getHealthStatus();
  const httpStatus = report.status === "down" ? 503 : 200;
  return Response.json(report, { status: httpStatus });
}
