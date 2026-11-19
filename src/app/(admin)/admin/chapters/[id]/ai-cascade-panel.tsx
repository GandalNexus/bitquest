"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Flame,
  ListChecks,
  Loader2,
  Map as MapIcon,
  Play,
  Plus,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { readCookie } from "@/lib/bitquest/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PendingButton } from "@/components/ui/pending-button";
import { useToast } from "@/hooks/use-toast";
import { ContentLink as Link } from "@/components/admin/content-link";

interface PlanItemStatus {
  title: string;
  status: "none" | "draft_pending" | "draft_approved" | "published" | "draft_rejected";
  draftId?: string;
  lessonId?: string;
}

const STATUS_META: Record<
  PlanItemStatus["status"],
  { label: string; className: string; icon: typeof Clock }
> = {
  none: {
    label: "Non générée",
    className: "border-muted-foreground/30 text-muted-foreground",
    icon: Clock,
  },
  draft_pending: {
    label: "Brouillon en review",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    icon: ListChecks,
  },
  draft_approved: {
    label: "Approuvé",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
    icon: CheckCircle2,
  },
  draft_rejected: {
    label: "Rejeté",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
    icon: XCircle,
  },
  published: {
    label: "Publiée",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
    icon: CheckCircle2,
  },
};

export function ChapterCascadePanel({
  chapterId,
  chapterTitle,
  courseTitle,
  initialPlan,
  initialStatuses,
}: {
  chapterId: string;
  chapterTitle: string;
  courseTitle: string;
  initialPlan: string[];
  initialStatuses: PlanItemStatus[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pendingNav, startTransition] = useTransition();
  const [plan, setPlan] = useState<string[]>(
    initialPlan.length > 0 ? initialPlan : [],
  );
  const [newItem, setNewItem] = useState("");
  const [audience, setAudience] = useState<"BEGINNER" | "INTERMEDIATE" | "ADVANCED">(
    "BEGINNER",
  );
  const [objective, setObjective] = useState("");
  const [busy, setBusy] = useState<{ kind: string; label?: string } | null>(null);

  // Map statuses par titre (normalisé) pour affichage.
  const statusByTitle = useMemo(() => {
    const map = new Map<string, PlanItemStatus>();
    for (const s of initialStatuses) map.set(s.title, s);
    return map;
  }, [initialStatuses]);

  const totalDone = initialStatuses.filter(
    (s) => s.status === "published" || s.status === "draft_approved",
  ).length;
  const totalPending = initialStatuses.filter((s) => s.status === "draft_pending").length;
  const totalRemaining = plan.filter(
    (t) => (statusByTitle.get(t)?.status ?? "none") === "none",
  ).length;

  const progressPct =
    plan.length > 0 ? Math.round(((plan.length - totalRemaining) / plan.length) * 100) : 0;

  const removeAt = (idx: number) => setPlan(plan.filter((_, i) => i !== idx));
  const addItem = () => {
    const t = newItem.trim();
    if (t.length < 4) {
      toast({
        title: "Titre trop court",
        description: "Minimum 4 caractères.",
        variant: "destructive",
      });
      return;
    }
    if (plan.length >= 12) {
      toast({
        title: "Plan plein",
        description: "Maximum 12 leçons par cascade.",
        variant: "destructive",
      });
      return;
    }
    setPlan([...plan, t]);
    setNewItem("");
  };

  const generateOne = async (title: string) => {
    setBusy({ kind: "one", label: title });
    try {
      const csrf = readCookie("bq_csrf");
      const res = await fetch(`/api/admin/ai/chapters/${chapterId}/cascade`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({
          titles: [title],
          audience,
          objective: objective.trim() || undefined,
          skipExisting: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        result?: { items: Array<{ status: string; reason?: string; draftId?: string }> };
      };
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      const item = data.result?.items[0];
      if (item?.status === "generated") {
        toast({ title: `Leçon « ${title} » générée`, description: "Visible dans /admin/ai-review." });
      } else if (item?.status.startsWith("skipped")) {
        toast({
          title: "Skippée",
          description: item.status === "skipped_lesson_published" ? "Leçon publiée existe déjà." : "Brouillon déjà en review.",
        });
      } else if (item?.status === "error") {
        toast({
          title: "Erreur sur cette leçon",
          description: item.reason ?? "Inconnue.",
          variant: "destructive",
        });
      }
      startTransition(() => router.refresh());
    } catch (e) {
      toast({
        title: "Génération impossible",
        description: e instanceof Error ? e.message : "Erreur inconnue.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const generateAll = async () => {
    const titlesToDo = plan.filter(
      (t) => (statusByTitle.get(t)?.status ?? "none") === "none",
    );
    if (titlesToDo.length === 0) {
      toast({ title: "Rien à générer", description: "Toutes les leçons existent déjà." });
      return;
    }
    setBusy({ kind: "all" });
    try {
      const csrf = readCookie("bq_csrf");
      const res = await fetch(`/api/admin/ai/chapters/${chapterId}/cascade`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({
          titles: titlesToDo,
          audience,
          objective: objective.trim() || undefined,
          skipExisting: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        result?: {
          generated: number;
          skipped: number;
          errored: number;
          totalPlan: number;
        };
      };
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      const r = data.result!;
      toast({
        title: "Cascade terminée",
        description: `Générées : ${r.generated} · Skippées : ${r.skipped} · Erreurs : ${r.errored} (sur ${r.totalPlan})`,
        variant: r.errored > 0 ? "destructive" : undefined,
      });
      startTransition(() => router.refresh());
    } catch (e) {
      toast({
        title: "Cascade impossible",
        description: e instanceof Error ? e.message : "Erreur inconnue.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const generateRelated = async (kind: "QUEST" | "CHALLENGE") => {
    setBusy({ kind: `related-${kind}` });
    try {
      const csrf = readCookie("bq_csrf");
      const res = await fetch(`/api/admin/ai/chapters/${chapterId}/related`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({ kind, audience }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        draft?: { payload?: { title?: string } };
      };
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      toast({
        title: `${kind === "QUEST" ? "Quête" : "Défi"} généré·e`,
        description: data.draft?.payload?.title
          ? `« ${data.draft.payload.title} » — review dans /admin/ai-review.`
          : "Review dans /admin/ai-review.",
      });
      startTransition(() => router.refresh());
    } catch (e) {
      toast({
        title: "Génération impossible",
        description: e instanceof Error ? e.message : "Erreur inconnue.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Génération IA en cascade
        </CardTitle>
        <CardDescription>
          Pilote la création des leçons du chapitre. Chaque leçon passe par la review avant publication.
        </CardDescription>
        {plan.length > 0 && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="tabular-nums">
              {totalDone}✓ {totalPending}⏳ {totalRemaining}✗ · {progressPct}%
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Plan de leçons
          </Label>
          {plan.length === 0 ? (
            <p className="rounded-md border border-dashed bg-background/50 px-3 py-4 text-center text-xs text-muted-foreground">
              Aucun plan importé. Ajoute des titres ci-dessous, ou génère d&apos;abord un chapitre via{" "}
              <Link href="/admin/ai-review" className="underline">
                /admin/ai-review
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-1.5">
              {plan.map((title, idx) => {
                const status = statusByTitle.get(title)?.status ?? "none";
                const meta = STATUS_META[status];
                const StatusIcon = meta.icon;
                const draftId = statusByTitle.get(title)?.draftId;
                const lessonId = statusByTitle.get(title)?.lessonId;
                const canGenerate = status === "none";
                const isBusyRow = busy?.kind === "one" && busy.label === title;
                return (
                  <li
                    key={`${title}-${idx}`}
                    className="flex items-center gap-2 rounded-md border bg-background p-2 text-sm"
                  >
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] text-muted-foreground">
                      {idx + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{title}</span>
                    <Badge variant="outline" className={`shrink-0 gap-1 ${meta.className}`}>
                      <StatusIcon className="h-3 w-3" aria-hidden />
                      {meta.label}
                    </Badge>
                    {draftId && (
                      <Link
                        href="/admin/ai-review"
                        className="shrink-0 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                      >
                        Review →
                      </Link>
                    )}
                    {lessonId && (
                      <Link
                        href={`/admin/lessons/${lessonId}`}
                        className="shrink-0 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                      >
                        Ouvrir →
                      </Link>
                    )}
                    {canGenerate && (
                      <PendingButton
                        type="button"
                        pending={isBusyRow || pendingNav}
                        pendingLabel=""
                        onClick={() => generateOne(title)}
                        className="shrink-0 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground hover:opacity-90"
                      >
                        {isBusyRow ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        Générer
                      </PendingButton>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAt(idx)}
                      disabled={!!busy || pendingNav}
                      aria-label="Supprimer du plan"
                      className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex gap-2">
            <Input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Nouveau titre de leçon…"
              maxLength={160}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
              disabled={!!busy}
            />
            <button
              type="button"
              onClick={addItem}
              disabled={!!busy}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter
            </button>
          </div>
        </div>

        {/* Options cascade */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="cascade-audience" className="text-xs">Public cible</Label>
            <select
              id="cascade-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value as typeof audience)}
              disabled={!!busy}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="BEGINNER">Débutant</option>
              <option value="INTERMEDIATE">Intermédiaire</option>
              <option value="ADVANCED">Avancé</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cascade-objective" className="text-xs">Objectif commun (optionnel)</Label>
            <Input
              id="cascade-objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Ex: Comprendre les fondamentaux Bitcoin"
              maxLength={300}
              disabled={!!busy}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex flex-wrap gap-2">
            <PendingButton
              type="button"
              pending={busy?.kind === "related-QUEST"}
              pendingLabel="Génération…"
              onClick={() => generateRelated("QUEST")}
              disabled={!!busy && busy.kind !== "related-QUEST"}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              <MapIcon className="h-3.5 w-3.5" />+ Quête liée
            </PendingButton>
            <PendingButton
              type="button"
              pending={busy?.kind === "related-CHALLENGE"}
              pendingLabel="Génération…"
              onClick={() => generateRelated("CHALLENGE")}
              disabled={!!busy && busy.kind !== "related-CHALLENGE"}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              <Flame className="h-3.5 w-3.5" />+ Défi lié
            </PendingButton>
          </div>
          <PendingButton
            type="button"
            pending={busy?.kind === "all"}
            pendingLabel={`Génération… (${totalRemaining})`}
            onClick={generateAll}
            disabled={plan.length === 0 || totalRemaining === 0 || (!!busy && busy.kind !== "all")}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Générer les {totalRemaining} leçon{totalRemaining > 1 ? "s" : ""} restante{totalRemaining > 1 ? "s" : ""}
          </PendingButton>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Chapitre : <strong>{chapterTitle}</strong> · Cours : {courseTitle}
        </p>
      </CardContent>
    </Card>
  );
}
