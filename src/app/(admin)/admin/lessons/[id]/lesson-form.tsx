"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import { readCookie } from "@/lib/bitquest/client";
import { PendingButton } from "@/components/ui/pending-button";

// MDXEditor dépend de Lexical (DOM only) → import dynamique sans SSR.
// Skeleton = textarea en lecture seule pour éviter un layout shift.
const MarkdownEditor = dynamic(
  () => import("@/components/admin/markdown-editor").then((m) => m.MarkdownEditor),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full animate-pulse rounded-md border bg-muted/30"
        style={{ minHeight: 400 }}
        aria-label="Chargement de l'éditeur"
      />
    ),
  },
);

interface LessonInitial {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  estimatedMinutes: number;
  order: number;
  publishedAt: string | null;
}

export function LessonForm({ initial }: { initial: LessonInitial }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<LessonInitial>(initial);
  const [preview, setPreview] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const csrf = readCookie("bq_csrf");
    const body = {
      slug: state.slug,
      title: state.title,
      summary: state.summary,
      content: state.content,
      estimatedMinutes: state.estimatedMinutes,
      order: state.order,
      publishedAt: state.publishedAt,
    };
    try {
      const res = await fetch(`/api/admin/lessons/${initial.id}`, {
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
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  const onDelete = async () => {
    if (!confirm("Supprimer définitivement cette leçon ? Les progressions utilisateur seront aussi effacées.")) return;
    setError(null);
    const csrf = readCookie("bq_csrf");
    try {
      const res = await fetch(`/api/admin/lessons/${initial.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: csrf ? { "X-CSRF-Token": csrf } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      startTransition(() => router.back());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-5">
        <label className="text-sm sm:col-span-2">
          <span className="block font-medium">Slug</span>
          <input
            type="text"
            required
            value={state.slug}
            onChange={(e) => setState({ ...state, slug: e.target.value })}
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm sm:col-span-3">
          <span className="block font-medium">Titre</span>
          <input
            type="text"
            required
            value={state.title}
            onChange={(e) => setState({ ...state, title: e.target.value })}
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm sm:col-span-3">
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
          <span className="block font-medium">Minutes</span>
          <input
            type="number"
            min={1}
            value={state.estimatedMinutes}
            onChange={(e) => setState({ ...state, estimatedMinutes: Number(e.target.value) || 5 })}
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

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Contenu (Markdown WYSIWYG)</span>
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            aria-pressed={preview}
          >
            {preview ? "Éditer" : "Aperçu brut"}
          </button>
        </div>
        {preview ? (
          <article className="prose prose-invert max-w-none rounded-md border bg-background/60 p-4 dark:prose-invert">
            <ReactMarkdown>{state.content}</ReactMarkdown>
          </article>
        ) : (
          <MarkdownEditor
            value={state.content}
            onChange={(next) => setState({ ...state, content: next })}
            placeholder="## Titre de la leçon&#10;&#10;Écris en Markdown — les raccourcis `#`, `*`, `>`, `[lien](url)` fonctionnent."
          />
        )}
      </div>

      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.publishedAt !== null}
          onChange={(e) =>
            setState({ ...state, publishedAt: e.target.checked ? new Date().toISOString() : null })
          }
        />
        <span>{state.publishedAt ? "Publiée (visible au public)" : "Brouillon (cachée)"}</span>
      </label>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <PendingButton
          type="button"
          onClick={onDelete}
          pending={pending}
          pendingLabel="Suppression…"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
        >
          Supprimer la leçon
        </PendingButton>
        <PendingButton
          type="submit"
          pending={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Enregistrer
        </PendingButton>
      </div>
    </form>
  );
}
