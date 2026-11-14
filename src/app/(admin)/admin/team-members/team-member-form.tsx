"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { readCookie } from "@/lib/bitquest/client";
import { useContentBasePath } from "@/lib/admin/base-path";

interface TeamMemberInitial {
  id?: string;
  name: string;
  role: string;
  contribution: string;
  initials: string;
  avatarUrl: string;
  order: number;
  publishedAt: string | null;
}

export function TeamMemberForm({
  initial,
  mode,
}: {
  initial: TeamMemberInitial;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const basePath = useContentBasePath();
  const listUrl = `${basePath}/team-members`;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<TeamMemberInitial>(initial);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const csrf = readCookie("bq_csrf");
    const url = mode === "create" ? "/api/admin/team-members" : `/api/admin/team-members/${initial.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const body = {
      name: state.name,
      role: state.role,
      contribution: state.contribution,
      initials: state.initials,
      avatarUrl: state.avatarUrl.trim().length > 0 ? state.avatarUrl.trim() : null,
      order: state.order,
      publishedAt: state.publishedAt,
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
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      }
      startTransition(() => {
        if (mode === "create") router.push(listUrl);
        else router.refresh();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  const onDelete = async () => {
    if (!initial.id || !confirm("Supprimer définitivement ce membre ?")) return;
    setError(null);
    const csrf = readCookie("bq_csrf");
    try {
      const res = await fetch(`/api/admin/team-members/${initial.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: csrf ? { "X-CSRF-Token": csrf } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      startTransition(() => router.push(listUrl));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-6">
        <label className="block text-sm sm:col-span-4">
          <span className="block font-medium">
            Nom <span className="text-destructive">*</span>
          </span>
          <input
            type="text"
            required
            value={state.name}
            onChange={(e) => setState({ ...state, name: e.target.value })}
            placeholder="Alhassane Diallo"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="block font-medium">
            Initiales <span className="text-destructive">*</span>
          </span>
          <input
            type="text"
            required
            maxLength={4}
            value={state.initials}
            onChange={(e) => setState({ ...state, initials: e.target.value })}
            placeholder="AD"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-center font-display text-sm uppercase"
          />
        </label>
        <label className="block text-sm">
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
          Rôle <span className="text-destructive">*</span>
        </span>
        <input
          type="text"
          required
          value={state.role}
          onChange={(e) => setState({ ...state, role: e.target.value })}
          placeholder="Lead ingénieur · architecte"
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="block font-medium">
          Contribution <span className="text-destructive">*</span>
        </span>
        <textarea
          required
          rows={3}
          value={state.contribution}
          onChange={(e) => setState({ ...state, contribution: e.target.value })}
          placeholder="Design système, auth, protocole BitQuest ↔ BitLab"
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="block font-medium">URL avatar (optionnelle)</span>
        <input
          type="url"
          value={state.avatarUrl}
          onChange={(e) => setState({ ...state, avatarUrl: e.target.value })}
          placeholder="https://…"
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-[11px] text-muted-foreground">
          Laisse vide pour utiliser les initiales en avatar fallback.
        </span>
      </label>

      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.publishedAt !== null}
          onChange={(e) =>
            setState({
              ...state,
              publishedAt: e.target.checked ? new Date().toISOString() : null,
            })
          }
        />
        <span>
          {state.publishedAt
            ? "Publié (visible sur la landing)"
            : "Brouillon (caché)"}
        </span>
      </label>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div>
          {mode === "edit" && (
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              Supprimer
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={listUrl}
            className="rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Annuler
          </a>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {mode === "create" ? "Créer le membre" : "Enregistrer"}
          </button>
        </div>
      </div>
    </form>
  );
}
