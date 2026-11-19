"use client";

import { useState } from "react";
import { Save, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PendingButton } from "@/components/ui/pending-button";
import { readCookie } from "@/lib/bitquest/client";
import { useToast } from "@/hooks/use-toast";

type DraftType = "QUEST" | "LESSON" | "CHAPTER" | "CHALLENGE";

interface EditorProps {
  draftId: string;
  type: DraftType;
  payload: Record<string, unknown>;
  onDone: () => void;
  onCancel: () => void;
}

/**
 * Éditeur inline des champs clés d'un brouillon IA, envoie les changements
 * en `overrides` au moment de l'approve. Pas tous les champs exposés
 * (volontaire — édition massive = re-générer).
 */
export function DraftEditor({ draftId, type, payload, onDone, onCancel }: EditorProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});

  const set = (key: string, value: unknown) => setOverrides((o) => ({ ...o, [key]: value }));
  const get = <T,>(key: string, fallback: T): T =>
    (overrides[key] as T) ?? (payload[key] as T) ?? fallback;

  const save = async () => {
    setSaving(true);
    try {
      const csrf = readCookie("bq_csrf");
      const res = await fetch(`/api/admin/ai/drafts/${draftId}/approve`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({ overrides }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      toast({
        title: "Publié avec modifications",
        description: "Visible dans l'admin correspondant.",
      });
      onDone();
    } catch (e) {
      toast({
        title: "Approbation impossible",
        description: e instanceof Error ? e.message : "Erreur inconnue.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-primary/40 bg-primary/5 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Édition avant publication</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Annuler l'édition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Champs communs */}
      <div className="space-y-1.5">
        <Label className="text-xs">Titre</Label>
        <Input
          value={get<string>("title", "")}
          onChange={(e) => set("title", e.target.value)}
          maxLength={80}
          disabled={saving}
        />
      </div>

      {type === "LESSON" && (
        <LessonEditor get={get} set={set} saving={saving} />
      )}
      {type === "QUEST" && <QuestEditor get={get} set={set} saving={saving} />}
      {type === "CHAPTER" && <ChapterEditor get={get} set={set} saving={saving} />}
      {type === "CHALLENGE" && <ChallengeEditor get={get} set={set} saving={saving} />}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-60"
        >
          Annuler
        </button>
        <PendingButton
          type="button"
          pending={saving}
          pendingLabel="Publication…"
          onClick={save}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Save className="h-3.5 w-3.5" />
          Enregistrer et publier
        </PendingButton>
      </div>
    </div>
  );
}

/* ============================================================
 * Sous-éditeurs par type — seulement les champs principaux
 * ============================================================ */

type Getter = <T>(k: string, fb: T) => T;
type Setter = (k: string, v: unknown) => void;

function LessonEditor({ get, set, saving }: { get: Getter; set: Setter; saving: boolean }) {
  const objectives = get<string[]>("objectives", []);
  const keypoints = get<string[]>("keypoints", []);
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs">Résumé</Label>
        <textarea
          value={get<string>("summary", "")}
          onChange={(e) => set("summary", e.target.value)}
          maxLength={240}
          rows={2}
          disabled={saving}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Introduction</Label>
        <textarea
          value={get<string>("intro", "")}
          onChange={(e) => set("intro", e.target.value)}
          maxLength={800}
          rows={3}
          disabled={saving}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <ListEditor
        label="Objectifs"
        values={objectives}
        onChange={(v) => set("objectives", v)}
        min={2}
        max={5}
        maxLen={200}
        disabled={saving}
      />
      <ListEditor
        label="Points essentiels"
        values={keypoints}
        onChange={(v) => set("keypoints", v)}
        min={2}
        max={6}
        maxLen={200}
        disabled={saving}
      />
      <div className="space-y-1.5">
        <Label className="text-xs">Conclusion</Label>
        <textarea
          value={get<string>("conclusion", "")}
          onChange={(e) => set("conclusion", e.target.value)}
          maxLength={500}
          rows={2}
          disabled={saving}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Les sections détaillées restent dans le payload JSON et seront publiées telles quelles.
        Pour une refonte complète, rejette et régénère.
      </p>
    </>
  );
}

function QuestEditor({ get, set, saving }: { get: Getter; set: Setter; saving: boolean }) {
  const objectives = get<string[]>("objectives", []);
  const steps = get<string[]>("steps", []);
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs">Sous-titre</Label>
        <Input
          value={get<string>("subtitle", "")}
          onChange={(e) => set("subtitle", e.target.value)}
          maxLength={160}
          disabled={saving}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Scénario</Label>
        <textarea
          value={get<string>("scenario", "")}
          onChange={(e) => set("scenario", e.target.value)}
          maxLength={400}
          rows={2}
          disabled={saving}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Mission</Label>
        <textarea
          value={get<string>("mission", "")}
          onChange={(e) => set("mission", e.target.value)}
          maxLength={300}
          rows={2}
          disabled={saving}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <ListEditor
        label="Objectifs"
        values={objectives}
        onChange={(v) => set("objectives", v)}
        min={2}
        max={5}
        maxLen={200}
        disabled={saving}
      />
      <ListEditor
        label="Étapes"
        values={steps}
        onChange={(v) => set("steps", v)}
        min={2}
        max={8}
        maxLen={250}
        disabled={saving}
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">XP</Label>
          <Input
            type="number"
            min={10}
            max={500}
            value={get<number>("xpReward", 50)}
            onChange={(e) => set("xpReward", Number(e.target.value) || 50)}
            disabled={saving}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Sats</Label>
          <Input
            type="number"
            min={0}
            max={2000}
            value={get<number>("satsReward", 25)}
            onChange={(e) => set("satsReward", Number(e.target.value) || 0)}
            disabled={saving}
          />
        </div>
      </div>
    </>
  );
}

function ChapterEditor({ get, set, saving }: { get: Getter; set: Setter; saving: boolean }) {
  const plan = get<string[]>("lessonsPlan", []);
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs">Résumé</Label>
        <textarea
          value={get<string>("summary", "")}
          onChange={(e) => set("summary", e.target.value)}
          maxLength={240}
          rows={2}
          disabled={saving}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Objectif</Label>
        <textarea
          value={get<string>("objective", "")}
          onChange={(e) => set("objective", e.target.value)}
          maxLength={300}
          rows={2}
          disabled={saving}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <ListEditor
        label="Plan de leçons"
        values={plan}
        onChange={(v) => set("lessonsPlan", v)}
        min={2}
        max={8}
        maxLen={120}
        disabled={saving}
      />
    </>
  );
}

function ChallengeEditor({ get, set, saving }: { get: Getter; set: Setter; saving: boolean }) {
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs">Consigne (prompt)</Label>
        <textarea
          value={get<string>("prompt", "")}
          onChange={(e) => set("prompt", e.target.value)}
          maxLength={1000}
          rows={4}
          disabled={saving}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Réponse attendue (admin only)</Label>
        <Input
          value={get<string>("expectedAnswer", "")}
          onChange={(e) => set("expectedAnswer", e.target.value)}
          maxLength={400}
          disabled={saving}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">XP</Label>
          <Input
            type="number"
            min={5}
            max={200}
            value={get<number>("xpReward", 15)}
            onChange={(e) => set("xpReward", Number(e.target.value) || 15)}
            disabled={saving}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Sats</Label>
          <Input
            type="number"
            min={0}
            max={500}
            value={get<number>("satsReward", 10)}
            onChange={(e) => set("satsReward", Number(e.target.value) || 0)}
            disabled={saving}
          />
        </div>
      </div>
    </>
  );
}

/* Éditeur générique pour arrays de strings bornés. */
function ListEditor({
  label,
  values,
  onChange,
  max,
  maxLen,
  disabled,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  min: number;
  max: number;
  maxLen: number;
  disabled: boolean;
}) {
  const update = (idx: number, v: string) => {
    const next = [...values];
    next[idx] = v;
    onChange(next);
  };
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label} ({values.length}/{max})</Label>
      {values.map((v, idx) => (
        <div key={idx} className="flex gap-1">
          <Input
            value={v}
            onChange={(e) => update(idx, e.target.value)}
            maxLength={maxLen}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => onChange(values.filter((_, i) => i !== idx))}
            disabled={disabled}
            className="shrink-0 rounded-md border px-2 text-xs text-muted-foreground hover:text-destructive disabled:opacity-40"
            aria-label="Retirer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {values.length < max && (
        <button
          type="button"
          onClick={() => onChange([...values, ""])}
          disabled={disabled}
          className="text-[11px] text-primary hover:underline disabled:opacity-40"
        >
          + ajouter
        </button>
      )}
    </div>
  );
}
