"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { readCookie } from "@/lib/bitquest/client";
import { useContentBasePath } from "@/lib/admin/base-path";
import { PendingButton } from "@/components/ui/pending-button";

interface ChapterInitial {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  order: number;
}

export function ChapterForm({
  initial,
  mode,
  courseId,
  compact = false,
}: {
  initial: ChapterInitial;
  mode: "create" | "edit";
  courseId?: string; // requis en create
  compact?: boolean;
}) {
  const router = useRouter();
  const basePath = useContentBasePath();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ChapterInitial>(initial);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const csrf = readCookie("bq_csrf");
    const url =
      mode === "create"
        ? `/api/admin/courses/${courseId}/chapters`
        : `/api/admin/chapters/${initial.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const body = {
      slug: state.slug,
      title: state.title,
      summary: state.summary,
      order: state.order,
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
        if (mode === "create") {
          setState({ slug: "", title: "", summary: "", order: 0 });
          router.refresh();
        } else {
          router.refresh();
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  const onDelete = async () => {
    if (!initial.id || !confirm("Supprimer ce chapitre ?")) return;
    setError(null);
    const csrf = readCookie("bq_csrf");
    try {
      const res = await fetch(`/api/admin/chapters/${initial.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: csrf ? { "X-CSRF-Token": csrf } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      startTransition(() => router.push(`${basePath}/courses`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className={compact ? "grid gap-3 sm:grid-cols-4" : "grid gap-3 sm:grid-cols-2"}>
        <label className="text-sm">
          <span className="block font-medium">Slug</span>
          <input
            type="text"
            required
            value={state.slug}
            onChange={(e) => setState({ ...state, slug: e.target.value })}
            placeholder="propriete-numerique"
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="block font-medium">Titre</span>
          <input
            type="text"
            required
            value={state.title}
            onChange={(e) => setState({ ...state, title: e.target.value })}
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className={compact ? "text-sm sm:col-span-1" : "text-sm sm:col-span-2"}>
          <span className="block font-medium">Résumé</span>
          <input
            type="text"
            required
            value={state.summary}
            onChange={(e) => setState({ ...state, summary: e.target.value })}
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          />
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
      {error && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between">
        {mode === "edit" ? (
          <PendingButton
            type="button"
            onClick={onDelete}
            pending={pending}
            pendingLabel="Suppression…"
            className="rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"
          >
            Supprimer
          </PendingButton>
        ) : <span />}
        <PendingButton
          type="submit"
          pending={pending}
          pendingLabel={mode === "create" ? "Création…" : "Enregistrement…"}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {mode === "create" ? "Ajouter le chapitre" : "Enregistrer"}
        </PendingButton>
      </div>
    </form>
  );
}
