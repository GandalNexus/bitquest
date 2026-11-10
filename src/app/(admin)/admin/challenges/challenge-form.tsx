"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { readCookie } from "@/lib/bitquest/client";

interface ChallengeInitial {
  id?: string;
  date: string; // YYYY-MM-DD
  title: string;
  prompt: string;
  xpReward: number;
  satsReward: number;
}

export function ChallengeForm({
  initial,
  mode,
  completionsCount = 0,
}: {
  initial: ChallengeInitial;
  mode: "create" | "edit";
  completionsCount?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [state, setState] = useState<ChallengeInitial>(initial);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const csrf = readCookie("bq_csrf");
    const url = mode === "create" ? "/api/admin/challenges" : `/api/admin/challenges/${initial.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const body = {
      date: state.date,
      title: state.title,
      prompt: state.prompt,
      xpReward: state.xpReward,
      satsReward: state.satsReward,
    };
    try {
      const res = await fetch(url, {
        method,
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
      startTransition(() => {
        if (mode === "create") router.push("/admin/challenges");
        else router.refresh();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  const onDelete = async (force: boolean) => {
    if (!initial.id) return;
    if (!force && !confirm("Supprimer ce défi ?")) return;
    setError(null);
    const csrf = readCookie("bq_csrf");
    try {
      const res = await fetch(`/api/admin/challenges/${initial.id}${force ? "?force=true" : ""}`, {
        method: "DELETE",
        credentials: "include",
        headers: csrf ? { "X-CSRF-Token": csrf } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && !force) {
        const msg = (data as { error?: string }).error ?? "Défi validé par des users.";
        if (confirm(`${msg}\n\nConfirmer la suppression en cascade ?`)) {
          return onDelete(true);
        }
        return;
      }
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      startTransition(() => router.push("/admin/challenges"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="block font-medium">Date (UTC)</span>
          <input
            type="date"
            required
            value={state.date}
            onChange={(e) => setState({ ...state, date: e.target.value })}
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="block font-medium">XP récompense</span>
          <input
            type="number"
            min={0}
            max={500}
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
            max={500}
            value={state.satsReward}
            onChange={(e) => setState({ ...state, satsReward: Number(e.target.value) || 0 })}
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
        <span className="block font-medium">Prompt (consigne de l&apos;apprenant)</span>
        <textarea
          required
          rows={5}
          value={state.prompt}
          onChange={(e) => setState({ ...state, prompt: e.target.value })}
          className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        />
      </label>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {saved && !error && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
          {mode === "create" ? "Défi créé." : "Modifications enregistrées."}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div>
          {mode === "edit" && (
            <button
              type="button"
              onClick={() => onDelete(false)}
              disabled={pending}
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              Supprimer{completionsCount > 0 ? ` (${completionsCount} validation${completionsCount > 1 ? "s" : ""})` : ""}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a href="/admin/challenges" className="rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
            Annuler
          </a>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {mode === "create" ? "Créer le défi" : "Enregistrer"}
          </button>
        </div>
      </div>
    </form>
  );
}
