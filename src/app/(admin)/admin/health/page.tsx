import {
  Activity,
  CheckCircle2,
  Database,
  Gauge,
  MinusCircle,
  Server,
  Zap,
  XCircle,
} from "lucide-react";
import { getHealthStatus, HEALTH_DEGRADED_MS, type HealthReport } from "@/lib/health";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminOrDenied } from "../_require-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusStyles: Record<string, { label: string; className: string }> = {
  ok: { label: "OK", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" },
  degraded: { label: "DEGRADED", className: "border-amber-500/40 bg-amber-500/10 text-amber-500" },
  down: { label: "DOWN", className: "border-destructive/40 bg-destructive/10 text-destructive" },
};

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}j ${hours % 24}h`;
}

export default async function AdminHealthPage() {
  const gate = await requireAdminOrDenied();
  if (!gate.ok) return gate.element;

  const report: HealthReport = await getHealthStatus();
  const style = statusStyles[report.status];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">État du service</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rafraîchir la page pour un snapshot à jour. Endpoint public exposé sur{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">/api/health</code>
          {" "} (200 si up, 503 si DB inaccessible).
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" aria-hidden />
              Statut global
            </CardTitle>
            <CardDescription>Agrégat des checks ci-dessous.</CardDescription>
          </div>
          <Badge variant="outline" className={style.className}>
            {style.label}
          </Badge>
        </CardHeader>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-primary" aria-hidden />
              Base de données
            </CardTitle>
            {report.db.status === "ok" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" aria-hidden />
            )}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Status" value={report.db.status} />
            <Row
              label="Latence"
              value={report.db.latencyMs === null ? "—" : `${report.db.latencyMs} ms`}
              hint={
                report.db.latencyMs !== null && report.db.latencyMs > HEALTH_DEGRADED_MS
                  ? `au-delà du seuil (${HEALTH_DEGRADED_MS} ms)`
                  : undefined
              }
            />
            {report.db.error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                <strong>Erreur :</strong> {report.db.error}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-primary" aria-hidden />
              Redis (rate-limit)
            </CardTitle>
            {report.redis.status === "ok" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />
            ) : report.redis.status === "skipped" ? (
              <MinusCircle className="h-5 w-5 text-muted-foreground" aria-hidden />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" aria-hidden />
            )}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Status" value={report.redis.status} />
            <Row
              label="Latence"
              value={report.redis.latencyMs === null ? "—" : `${report.redis.latencyMs} ms`}
              hint={
                report.redis.status === "ok" && report.redis.latencyMs > HEALTH_DEGRADED_MS
                  ? `au-delà du seuil (${HEALTH_DEGRADED_MS} ms)`
                  : undefined
              }
            />
            {report.redis.status === "skipped" && (
              <p className="text-xs text-muted-foreground">
                REDIS_URL non défini — le rate-limit utilise le fallback in-memory.
              </p>
            )}
            {report.redis.status === "error" && report.redis.error && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-500">
                <strong>Erreur :</strong> {report.redis.error}
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Non critique — le fallback in-memory prend le relais.
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-4 w-4 text-primary" aria-hidden />
              Serveur
            </CardTitle>
            <Gauge className="h-5 w-5 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Uptime" value={formatUptime(report.uptime)} />
            <Row label="Environnement" value={report.env} />
            <Row label="Version" value={report.version} />
            <Row label="Heure serveur" value={report.now} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b pb-1.5 last:border-b-0 last:pb-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right">
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{value}</code>
        {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
      </span>
    </div>
  );
}
