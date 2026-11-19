"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, X } from "lucide-react";
import { readCookie } from "@/lib/bitquest/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PendingButton } from "@/components/ui/pending-button";
import { useToast } from "@/hooks/use-toast";

type DraftType = "QUEST" | "LESSON" | "CHAPTER" | "CHALLENGE";

interface DraftRow {
  id: string;
  type: string;
  status: string;
  payload: string;
  aiModel: string;
  rejectReason: string | null;
  publishedId: string | null;
  createdAt: string;
  reviewedAt: string | null;
  tokensInput: number | null;
  tokensOutput: number | null;
}

const TYPE_LABEL: Record<DraftType, string> = {
  QUEST: "Quête",
  LESSON: "Leçon",
  CHAPTER: "Chapitre",
  CHALLENGE: "Défi quotidien",
};

export function AIReviewPanel({ drafts }: { drafts: DraftRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [type, setType] = useState<DraftType>("QUEST");
  const [hint, setHint] = useState("");
  const [generating, setGenerating] = useState(false);
  const [pendingAction, startAction] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);

  const pending = drafts.filter((d) => d.status === "PENDING");
  const history = drafts.filter((d) => d.status !== "PENDING");

  const onGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const csrf = readCookie("bq_csrf");
      const res = await fetch(`/api/admin/ai/generate/${type.toLowerCase()}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({ hint: hint.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      toast({
        title: "Brouillon généré",
        description: "Review-le ci-dessous, puis Approuve ou Rejette.",
      });
      setHint("");
      startAction(() => router.refresh());
    } catch (e) {
      toast({
        title: "Génération impossible",
        description: e instanceof Error ? e.message : "Erreur inconnue.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const onApprove = async (id: string) => {
    setActiveId(id);
    try {
      const csrf = readCookie("bq_csrf");
      const res = await fetch(`/api/admin/ai/drafts/${id}/approve`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      toast({ title: "Publié", description: "Visible dans l'admin correspondant." });
      startAction(() => router.refresh());
    } catch (e) {
      toast({
        title: "Approbation impossible",
        description: e instanceof Error ? e.message : "Erreur inconnue.",
        variant: "destructive",
      });
    } finally {
      setActiveId(null);
    }
  };

  const onReject = async (id: string) => {
    const reason = window.prompt("Raison du rejet (optionnel) :")?.trim() ?? "";
    setActiveId(id);
    try {
      const csrf = readCookie("bq_csrf");
      const res = await fetch(`/api/admin/ai/drafts/${id}/reject`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      toast({ title: "Brouillon rejeté" });
      startAction(() => router.refresh());
    } catch (e) {
      toast({
        title: "Rejet impossible",
        description: e instanceof Error ? e.message : "Erreur inconnue.",
        variant: "destructive",
      });
    } finally {
      setActiveId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Générer un brouillon
          </CardTitle>
          <CardDescription>
            Claude Opus 4.7 propose un nouveau contenu cohérent avec la taxonomie actuelle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="type" className="text-xs">Type</Label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as DraftType)}
                disabled={generating || pendingAction}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {(Object.keys(TYPE_LABEL) as DraftType[]).map((t) => (
                  <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hint" className="text-xs">Focus (optionnel)</Label>
              <Input
                id="hint"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder='Ex: "Lightning watchtowers", "Taproot basics"'
                disabled={generating || pendingAction}
                maxLength={500}
              />
            </div>
          </div>
          <PendingButton
            type="button"
            pending={generating || pendingAction}
            pendingLabel="Génération…"
            onClick={onGenerate}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Générer un {TYPE_LABEL[type]}
          </PendingButton>
        </CardContent>
      </Card>

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            En attente de review ({pending.length})
          </h2>
          {pending.map((d) => (
            <DraftCard
              key={d.id}
              draft={d}
              onApprove={() => onApprove(d.id)}
              onReject={() => onReject(d.id)}
              busy={activeId === d.id || pendingAction}
            />
          ))}
        </section>
      )}

      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Historique récent
          </h2>
          {history.map((d) => (
            <HistoryRow key={d.id} draft={d} />
          ))}
        </section>
      )}
    </div>
  );
}

function DraftCard({
  draft,
  onApprove,
  onReject,
  busy,
}: {
  draft: DraftRow;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const payload = JSON.parse(draft.payload) as Record<string, unknown>;
  const title = String(payload.title ?? "(sans titre)");
  const subtitle = String(payload.subtitle ?? payload.summary ?? "");
  const slug = String(payload.code ?? payload.slug ?? payload.date ?? "");

  return (
    <Card>
      <CardHeader className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="outline">{draft.type}</Badge>
          {slug && <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{slug}</code>}
        </div>
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <details className="rounded-md border bg-muted/30 p-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Payload complet
          </summary>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap font-mono text-[11px]">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </details>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>{draft.aiModel}</span>
          {typeof draft.tokensOutput === "number" && (
            <span>{draft.tokensOutput} tokens sortie</span>
          )}
          <span>· {new Date(draft.createdAt).toLocaleString("fr-FR")}</span>
        </div>
        <div className="flex items-center justify-between pt-2">
          <PendingButton
            type="button"
            pending={busy}
            pendingLabel="Rejet…"
            onClick={onReject}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
          >
            <X className="h-3.5 w-3.5" />
            Rejeter
          </PendingButton>
          <PendingButton
            type="button"
            pending={busy}
            pendingLabel="Publication…"
            onClick={onApprove}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Check className="h-3.5 w-3.5" />
            Approuver et publier
          </PendingButton>
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryRow({ draft }: { draft: DraftRow }) {
  const payload = JSON.parse(draft.payload) as Record<string, unknown>;
  const title = String(payload.title ?? "(sans titre)");
  const slug = String(payload.code ?? payload.slug ?? payload.date ?? "");
  const tone =
    draft.status === "APPROVED"
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
      : "border-muted-foreground/30 text-muted-foreground";
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          <Badge variant="outline">{draft.type}</Badge>
          {slug && <code className="rounded bg-muted px-1.5 py-0.5">{slug}</code>}
        </div>
        {draft.rejectReason && (
          <p className="text-muted-foreground">Raison : {draft.rejectReason}</p>
        )}
      </div>
      <Badge variant="outline" className={tone}>
        {draft.status}
      </Badge>
    </div>
  );
}
