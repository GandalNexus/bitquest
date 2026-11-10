"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { readCookie } from "@/lib/bitquest/client";

const TRACKS = ["INITIATION", "INTERMEDIATE", "ADVANCED", "SPECIAL"] as const;
type Track = (typeof TRACKS)[number];

interface QuestInitial {
  code: string;
  track: Track;
  order: number;
  title: string;
  subtitle: string;
  description: string;
  intro: string;
  xpReward: number;
  satsReward: number;
  requiredLevel: number;
}

/**
 * Formulaire d'édition des métadonnées d'une quête. Le `code` est en
 * lecture seule (identifiant public immuable).
 */
export function QuestForm({ initial }: { initial: QuestInitial }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [state, setState] = useState<QuestInitial>(initial);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const csrf = readCookie("bq_csrf");
    const body = {
      track: state.track,
      order: state.order,
      title: state.title,
      subtitle: state.subtitle,
      description: state.description,
      intro: state.intro,
      xpReward: state.xpReward,
      satsReward: state.satsReward,
      requiredLevel: state.requiredLevel,
    };
    try {
      const res = await fetch(`/api/admin/quests/${initial.code}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      setSaved(true);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm sm:col-span-1">
          <span className="block font-medium">
            Code <span className="text-xs text-muted-foreground">(lecture seule)</span>
          </span>
          <input
            type="text"
            value={initial.code}
            readOnly
            className="mt-1 w-full cursor-not-allowed rounded-md border bg-muted px-2 py-1.5 text-sm text-muted-foreground"
          />
        </label>
        <label className="text-sm">
          <span className="block font-medium">Track</span>
          <select
            value={state.track}
            onChange={(e) => setState({ ...state, track: e.target.value as Track })}
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
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
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="block font-medium">Titre</span>
        <input
          type="text"
          required
          value={state.title}
          onChange={(e) => setState({ ...state, title: e.target.value })}
          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="block font-medium">Sous-titre</span>
        <input
          type="text"
          required
          value={state.subtitle}
          onChange={(e) => setState({ ...state, subtitle: e.target.value })}
          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="block font-medium">Description (carte quête)</span>
        <textarea
          required
          rows={3}
          value={state.description}
          onChange={(e) => setState({ ...state, description: e.target.value })}
          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="block font-medium">Intro (écran d&apos;accueil de la quête)</span>
        <textarea
          required
          rows={4}
          value={state.intro}
          onChange={(e) => setState({ ...state, intro: e.target.value })}
          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
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
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="block font-medium">Sats récompense</span>
          <input
            type="number"
            min={0}
            value={state.satsReward}
            onChange={(e) => setState({ ...state, satsReward: Number(e.target.value) || 0 })}
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
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
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {saved && !error && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
          Modifications enregistrées.
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          Enregistrer
        </button>
      </div>
    </form>
  );
}
