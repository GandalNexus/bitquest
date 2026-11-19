"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { readCookie } from "@/lib/bitquest/client";
import { PendingButton } from "@/components/ui/pending-button";
import { useToast } from "@/hooks/use-toast";

export function EnrichWithAIButton({ code }: { code: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);

  const onEnrich = async () => {
    if (running) return;
    const ok = window.confirm(
      "Regénérer les sections théoriques + le quiz ? Cela REMPLACE l'existant.",
    );
    if (!ok) return;
    setRunning(true);
    try {
      const csrf = readCookie("bq_csrf");
      const res = await fetch(`/api/admin/ai/enrich/${code}`, {
        method: "POST",
        credentials: "include",
        headers: { ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        sections?: number;
        questions?: number;
      };
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      toast({
        title: "Quête enrichie",
        description: `${data.sections} sections + ${data.questions} questions générées.`,
      });
      startTransition(() => router.refresh());
    } catch (e) {
      toast({
        title: "Enrichissement impossible",
        description: e instanceof Error ? e.message : "Erreur inconnue.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <PendingButton
      type="button"
      pending={running || pending}
      pendingLabel="Génération…"
      onClick={onEnrich}
      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
    >
      <Sparkles className="h-3.5 w-3.5" />
      Regénérer théorie + quiz
    </PendingButton>
  );
}
