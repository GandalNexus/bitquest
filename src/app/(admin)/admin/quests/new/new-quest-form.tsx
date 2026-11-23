"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { readCookie } from "@/lib/bitquest/client";
import { useContentBasePath } from "@/lib/admin/base-path";
import { PendingButton } from "@/components/ui/pending-button";

const TRACKS = ["INITIATION", "INTERMEDIATE", "ADVANCED", "SPECIAL"] as const;
const MISSION_TYPES = [
  "block_explorer",
  "key_forge",
  "tx_builder",
  "mine_nonce",
  "ln_channel",
  "ln_invoice",
  "multisig_sign",
  "taproot_tweak",
] as const;
const MISSION_KINDS = ["SIMULATED", "BITLAB_PROOF"] as const;

type Track = (typeof TRACKS)[number];
type MissionType = (typeof MISSION_TYPES)[number];
type MissionKind = (typeof MISSION_KINDS)[number];

const MISSION_KIND_HINT: Record<MissionKind, string> = {
  SIMULATED: "Mission purement locale/pédagogique — pas de preuve on-chain.",
  BITLAB_PROOF: "La mission exige une preuve BitLab (tx, block, invoice, channel, address).",
};

export function NewQuestForm() {
  const router = useRouter();
  const basePath = useContentBasePath();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState({
    code: "",
    track: "INITIATION" as Track,
    order: 0,
    title: "",
    subtitle: "",
    description: "",
    intro: "",
    xpReward: 50,
    satsReward: 0,
    requiredLevel: 1,
    missionType: "block_explorer" as MissionType,
    missionKind: "SIMULATED" as MissionKind,
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const csrf = readCookie("bq_csrf");
    try {
      const res = await fetch("/api/admin/quests", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify(state),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      const code = (data as { quest: { code: string } }).quest.code;
      startTransition(() => router.push(`${basePath}/quests/${code}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm sm:col-span-1">
          <span className="block font-medium">
            Code <span className="text-destructive">*</span>
          </span>
          <input
            type="text"
            required
            value={state.code}
            onChange={(e) => setState({ ...state, code: e.target.value })}
            placeholder="tx-basics"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            title="kebab-case uniquement (ex. tx-basics)"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Identifiant public immuable (kebab-case).
          </span>
        </label>
        <label className="text-sm">
          <span className="block font-medium">Track</span>
          <select
            value={state.track}
            onChange={(e) => setState({ ...state, track: e.target.value as Track })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {TRACKS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block font-medium">Ordre</span>
          <input
            type="number"
            min={0}
            value={state.order}
            onChange={(e) => setState({ ...state, order: Number(e.target.value) || 0 })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="block font-medium">
          Titre <span className="text-destructive">*</span>
        </span>
        <input
          type="text"
          required
          value={state.title}
          onChange={(e) => setState({ ...state, title: e.target.value })}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="block font-medium">
          Sous-titre <span className="text-destructive">*</span>
        </span>
        <input
          type="text"
          required
          value={state.subtitle}
          onChange={(e) => setState({ ...state, subtitle: e.target.value })}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="block font-medium">
          Description (carte quête) <span className="text-destructive">*</span>
        </span>
        <textarea
          required
          rows={3}
          value={state.description}
          onChange={(e) => setState({ ...state, description: e.target.value })}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="block font-medium">
          Intro (écran d&apos;accueil de la quête) <span className="text-destructive">*</span>
        </span>
        <textarea
          required
          rows={4}
          value={state.intro}
          onChange={(e) => setState({ ...state, intro: e.target.value })}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="block font-medium">XP récompense</span>
          <input
            type="number"
            min={0}
            value={state.xpReward}
            onChange={(e) => setState({ ...state, xpReward: Number(e.target.value) || 0 })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="block font-medium">Sats récompense</span>
          <input
            type="number"
            min={0}
            value={state.satsReward}
            onChange={(e) => setState({ ...state, satsReward: Number(e.target.value) || 0 })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="block font-medium">Niveau requis</span>
          <input
            type="number"
            min={1}
            max={10}
            value={state.requiredLevel}
            onChange={(e) => setState({ ...state, requiredLevel: Number(e.target.value) || 1 })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block font-medium">Type de mission</span>
          <select
            value={state.missionType}
            onChange={(e) => setState({ ...state, missionType: e.target.value as MissionType })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {MISSION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block font-medium">Kind</span>
          <select
            value={state.missionKind}
            onChange={(e) => setState({ ...state, missionKind: e.target.value as MissionKind })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {MISSION_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {MISSION_KIND_HINT[state.missionKind]}
          </span>
        </label>
      </div>

      <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
        Après création, utilise les onglets <strong>Théorie</strong>,{" "}
        <strong>Quiz</strong>, <strong>Mission</strong> de la page quête pour
        remplir les sections détaillées.
      </p>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <a
          href={`${basePath}/quests`}
          className="rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          Annuler
        </a>
        <PendingButton
          type="submit"
          pending={pending}
          pendingLabel="Création…"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Créer la quête
        </PendingButton>
      </div>
    </form>
  );
}
