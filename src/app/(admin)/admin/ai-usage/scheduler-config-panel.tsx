"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Play, Save } from "lucide-react";
import { readCookie } from "@/lib/bitquest/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PendingButton } from "@/components/ui/pending-button";
import { useToast } from "@/hooks/use-toast";

interface ConfigRow {
  type: string;
  enabled: boolean;
  cadenceHours: number;
  maxPerRun: number;
  hint: string;
  lastRunAt: string | null;
  lastError: string | null;
}

export function SchedulerConfigPanel({ configs }: { configs: ConfigRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-primary" />
          Génération automatique
        </CardTitle>
        <CardDescription>
          Un scheduler interne tourne toutes les 15 min et vérifie si chaque type est dû.
          Les brouillons générés automatiquement arrivent en &quot;Review drafts&quot; comme ceux
          déclenchés manuellement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {configs.map((c) => (
          <ConfigRowForm key={c.type} initial={c} />
        ))}
        <TriggerNow />
      </CardContent>
    </Card>
  );
}

function ConfigRowForm({ initial }: { initial: ConfigRow }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState(initial);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const csrf = readCookie("bq_csrf");
      const res = await fetch("/api/admin/ai/config", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({
          type: state.type,
          enabled: state.enabled,
          cadenceHours: state.cadenceHours,
          maxPerRun: state.maxPerRun,
          hint: state.hint,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      toast({ title: `Config ${state.type} enregistrée.` });
      startTransition(() => router.refresh());
    } catch (e) {
      toast({
        title: "Enregistrement impossible",
        description: e instanceof Error ? e.message : "Erreur inconnue.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{state.type}</Badge>
          {initial.lastRunAt ? (
            <span className="text-xs text-muted-foreground">
              Dernier run : {new Date(initial.lastRunAt).toLocaleString("fr-FR")}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Jamais exécuté.</span>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={state.enabled}
            onChange={(e) => setState({ ...state, enabled: e.target.checked })}
            disabled={saving || pending}
          />
          {state.enabled ? "Activé" : "Désactivé"}
        </label>
      </div>
      {initial.lastError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-[11px] text-destructive">
          Dernière erreur : {initial.lastError}
        </p>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Cadence (h)</Label>
          <Input
            type="number"
            min={1}
            max={720}
            value={state.cadenceHours}
            onChange={(e) => setState({ ...state, cadenceHours: Number(e.target.value) || 24 })}
            disabled={saving || pending}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Max par run</Label>
          <Input
            type="number"
            min={1}
            max={5}
            value={state.maxPerRun}
            onChange={(e) => setState({ ...state, maxPerRun: Number(e.target.value) || 1 })}
            disabled={saving || pending}
          />
        </div>
        <div className="space-y-1 sm:col-span-1">
          <Label className="text-xs">Hint par défaut</Label>
          <Input
            placeholder="(optionnel)"
            maxLength={500}
            value={state.hint}
            onChange={(e) => setState({ ...state, hint: e.target.value })}
            disabled={saving || pending}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <PendingButton
          type="button"
          pending={saving || pending}
          onClick={save}
          pendingLabel="Enregistrement…"
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs hover:bg-muted"
        >
          <Save className="h-3 w-3" /> Enregistrer
        </PendingButton>
      </div>
    </div>
  );
}

function TriggerNow() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);

  const trigger = async () => {
    if (running) return;
    setRunning(true);
    try {
      const csrf = readCookie("bq_csrf");
      const res = await fetch("/api/admin/ai/cron-tick", {
        method: "POST",
        credentials: "include",
        headers: { ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        skippedReason?: string;
        runs?: Array<{ type: string; generated: number; skipped?: string; error?: string }>;
      };
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      const summary =
        data.skippedReason === "kill_switch"
          ? "Kill-switch actif — aucune génération."
          : data.runs?.map((r) => `${r.type}: ${r.generated} généré(s)${r.error ? ` (erreur)` : ""}`).join(" · ") ?? "Aucun run.";
      toast({ title: "Tick exécuté", description: summary });
      startTransition(() => router.refresh());
    } catch (e) {
      toast({
        title: "Tick impossible",
        description: e instanceof Error ? e.message : "Erreur inconnue.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex justify-end pt-2">
      <PendingButton
        type="button"
        pending={running || pending}
        onClick={trigger}
        pendingLabel="Tick en cours…"
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        <Play className="h-3.5 w-3.5" /> Déclencher un tick maintenant
      </PendingButton>
    </div>
  );
}
