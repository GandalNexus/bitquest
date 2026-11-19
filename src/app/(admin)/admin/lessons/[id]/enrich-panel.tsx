"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flame, Map as MapIcon, Sparkles } from "lucide-react";
import { readCookie } from "@/lib/bitquest/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PendingButton } from "@/components/ui/pending-button";
import { useToast } from "@/hooks/use-toast";

/**
 * Panel "Enrichir avec l'IA" sur /admin/lessons/[id].
 *
 * Génère un contenu annexe (quête ou défi) contextualisé à la leçon.
 * Les quêtes sont auto-linkées au chapitre parent via `_bitquestMeta`
 * injecté par l'endpoint related. Les contenus arrivent en review.
 */
export function LessonEnrichPanel({
  lessonId,
  lessonTitle,
  chapterTitle,
  courseTitle,
}: {
  lessonId: string;
  lessonTitle: string;
  chapterTitle: string;
  courseTitle: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"QUEST" | "CHALLENGE" | null>(null);
  const [audience, setAudience] = useState<"BEGINNER" | "INTERMEDIATE" | "ADVANCED">(
    "BEGINNER",
  );
  const [customSubject, setCustomSubject] = useState("");

  const generate = async (kind: "QUEST" | "CHALLENGE") => {
    if (busy) return;
    setBusy(kind);
    try {
      const csrf = readCookie("bq_csrf");
      const res = await fetch(`/api/admin/ai/lessons/${lessonId}/related`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({
          kind,
          audience,
          subject: customSubject.trim() || undefined,
        }),
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
      setCustomSubject("");
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
          Enrichir avec l&apos;IA
        </CardTitle>
        <CardDescription>
          Génère un contenu annexe (quête pratique ou défi quotidien) contextualisé à
          cette leçon. Le contenu arrive en review avant publication. Les quêtes sont
          automatiquement liées au chapitre parent après approbation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]">
          <div className="space-y-1">
            <Label htmlFor="enrich-audience" className="text-xs">Public</Label>
            <select
              id="enrich-audience"
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
            <Label htmlFor="enrich-subject" className="text-xs">
              Angle personnalisé (optionnel)
            </Label>
            <Input
              id="enrich-subject"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              placeholder="Ex: Focus sur la vérification manuelle d'une tx"
              maxLength={500}
              disabled={!!busy}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <PendingButton
            type="button"
            pending={busy === "QUEST" || pending}
            pendingLabel="Génération…"
            onClick={() => generate("QUEST")}
            disabled={!!busy && busy !== "QUEST"}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <MapIcon className="h-3.5 w-3.5" />
            + Quête liée
          </PendingButton>
          <PendingButton
            type="button"
            pending={busy === "CHALLENGE" || pending}
            pendingLabel="Génération…"
            onClick={() => generate("CHALLENGE")}
            disabled={!!busy && busy !== "CHALLENGE"}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <Flame className="h-3.5 w-3.5" />
            + Défi quotidien
          </PendingButton>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Contexte transmis à Claude : <strong>{lessonTitle}</strong> ·{" "}
          {chapterTitle} · {courseTitle}
        </p>
      </CardContent>
    </Card>
  );
}
