"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface QuestOption {
  code: string;
  title: string;
  track: string;
}

interface LinkedQuest {
  questId: string;
  questCode: string;
  questTitle: string;
  order: number;
  note: string | null;
}

/**
 * Panneau admin pour gérer les ChapterQuest links (LOT 23).
 * Source du gate pédagogique LOT 16 : chaque lien = une quête à
 * compléter avant que ce chapitre devienne débloqué pour l'apprenant.
 */
export function LinkedQuestsPanel({
  chapterId,
  initial,
  availableQuests,
}: {
  chapterId: string;
  initial: LinkedQuest[];
  availableQuests: QuestOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<string>("");
  const [order, setOrder] = useState<string>("1");
  const [note, setNote] = useState<string>("");

  // Quêtes déjà liées — exclues du picker.
  const linkedCodes = new Set(initial.map((l) => l.questCode));
  const candidates = availableQuests.filter((q) => !linkedCodes.has(q.code));

  const csrf =
    typeof document !== "undefined"
      ? (document.cookie.split("; ").find((c) => c.startsWith("bq_csrf="))?.split("=")[1] ?? "")
      : "";

  const attach = async () => {
    if (!picked) return;
    const parsedOrder = Number.parseInt(order, 10);
    if (!Number.isFinite(parsedOrder) || parsedOrder < 0) {
      toast({ variant: "destructive", title: "Ordre invalide" });
      return;
    }
    const res = await fetch(`/api/admin/chapters/${chapterId}/quests`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": decodeURIComponent(csrf),
      },
      body: JSON.stringify({
        questCode: picked,
        order: parsedOrder,
        note: note.trim() || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erreur inconnue" }));
      toast({ variant: "destructive", title: "Attache impossible", description: err.error });
      return;
    }
    toast({ title: "Quête liée", description: `+ ${picked}` });
    setPicked("");
    setOrder("1");
    setNote("");
    startTransition(() => router.refresh());
  };

  const detach = async (questCode: string) => {
    if (!confirm(`Détacher « ${questCode} » de ce chapitre ?`)) return;
    const res = await fetch(
      `/api/admin/chapters/${chapterId}/quests?questCode=${encodeURIComponent(questCode)}`,
      {
        method: "DELETE",
        credentials: "include",
        headers: { "X-CSRF-Token": decodeURIComponent(csrf) },
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erreur inconnue" }));
      toast({ variant: "destructive", title: "Détache impossible", description: err.error });
      return;
    }
    toast({ title: "Quête détachée" });
    startTransition(() => router.refresh());
  };

  return (
    <div className="space-y-4">
      {initial.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune quête prérequise — ce chapitre sera accessible immédiatement.
        </p>
      ) : (
        <ul className="space-y-2">
          {initial.map((l) => (
            <li
              key={l.questCode}
              className="flex items-center gap-3 rounded-md border bg-background/60 p-2.5"
            >
              <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{l.questTitle}</div>
                <div className="truncate text-xs text-muted-foreground">
                  <code className="rounded bg-muted px-1 py-0.5 font-mono">{l.questCode}</code>
                  {" · ordre "}
                  {l.order}
                  {l.note && ` · ${l.note}`}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => detach(l.questCode)}
                disabled={pending}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {candidates.length > 0 && (
        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
          <Label className="text-xs">Lier une quête</Label>
          <div className="grid gap-2 sm:grid-cols-[1fr_80px]">
            <select
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
              className="rounded-md border bg-background px-3 py-2 text-sm"
              aria-label="Choisir une quête"
            >
              <option value="">Choisis une quête…</option>
              {candidates.map((q) => (
                <option key={q.code} value={q.code}>
                  [{q.track}] {q.title} ({q.code})
                </option>
              ))}
            </select>
            <Input
              type="number"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              placeholder="Ordre"
              min={0}
              max={999}
            />
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note pédagogique (optionnel, ≤ 500 chars)"
          />
          <Button size="sm" onClick={attach} disabled={!picked || pending} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            {pending ? "…" : "Lier"}
          </Button>
        </div>
      )}
      {candidates.length === 0 && initial.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Toutes les quêtes sont déjà liées à ce chapitre.
        </p>
      )}
    </div>
  );
}
