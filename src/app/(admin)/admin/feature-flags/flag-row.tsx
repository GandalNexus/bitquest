"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface FlagView {
  key: string;
  description: string;
  enabled: boolean;
  userIds: string[];
  updatedAt: string;
}

/**
 * Toggle visuel + éditeur de canary userIds pour un FeatureFlag.
 * ADMIN only — l'API /api/admin/feature-flags/[key] enforce côté serveur.
 */
export function FlagRow({ flag }: { flag: FlagView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [canary, setCanary] = useState<string>(flag.userIds.join(", "));

  const csrf =
    typeof document !== "undefined"
      ? (document.cookie.split("; ").find((c) => c.startsWith("bq_csrf="))?.split("=")[1] ?? "")
      : "";

  const patch = async (body: { enabled?: boolean; userIds?: string[] }) => {
    const res = await fetch(`/api/admin/feature-flags/${encodeURIComponent(flag.key)}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": decodeURIComponent(csrf),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erreur inconnue" }));
      toast({ variant: "destructive", title: "Update impossible", description: err.error });
      return false;
    }
    return true;
  };

  const toggle = async () => {
    const ok = await patch({ enabled: !flag.enabled });
    if (ok) {
      toast({
        title: flag.enabled ? "Flag désactivé" : "Flag activé",
        description: flag.key,
      });
      startTransition(() => router.refresh());
    }
  };

  const saveCanary = async () => {
    const parsed = canary
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 64);
    if (parsed.length > 100) {
      toast({
        variant: "destructive",
        title: "Trop d'IDs",
        description: "Maximum 100 user IDs en canary.",
      });
      return;
    }
    const ok = await patch({ userIds: parsed });
    if (ok) {
      toast({ title: "Canary mis à jour", description: `${parsed.length} user ID(s)` });
      startTransition(() => router.refresh());
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{flag.key}</code>
            </CardTitle>
            <CardDescription>{flag.description}</CardDescription>
          </div>
          <Button
            size="sm"
            variant={flag.enabled ? "default" : "outline"}
            onClick={toggle}
            disabled={pending}
            className={
              flag.enabled
                ? "gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                : "gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
            }
          >
            {flag.enabled ? (
              <>
                <Check className="h-3.5 w-3.5" />
                ON
              </>
            ) : (
              <>
                <X className="h-3.5 w-3.5" />
                OFF
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor={`canary-${flag.key}`} className="text-xs">
          Canary user IDs (CSV ou whitespace, max 100)
        </Label>
        <Input
          id={`canary-${flag.key}`}
          value={canary}
          onChange={(e) => setCanary(e.target.value)}
          placeholder="cm1abc… cm2def…"
          className="font-mono text-xs"
          disabled={pending}
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            Dernière mise à jour : {new Date(flag.updatedAt).toLocaleString("fr-FR")}
          </span>
          <Button size="sm" variant="outline" onClick={saveCanary} disabled={pending}>
            {pending ? "…" : "Enregistrer canary"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
