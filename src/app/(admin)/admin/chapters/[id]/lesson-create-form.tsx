"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { readCookie } from "@/lib/bitquest/client";

/**
 * Formulaire de création rapide d'une leçon. Le contenu est pré-rempli
 * avec un stub Markdown — l'édition complète se fait dans /admin/lessons/[id].
 */
export function LessonCreateForm({
  chapterId,
  nextOrder,
}: {
  chapterId: string;
  nextOrder: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState({
    slug: "",
    title: "",
    summary: "",
    estimatedMinutes: 5,
    order: nextOrder,
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const csrf = readCookie("bq_csrf");
    const body = {
      slug: state.slug,
      title: state.title,
      summary: state.summary,
      content: "## Nouvelle leçon\n\nÉcris le contenu Markdown ici.",
      estimatedMinutes: state.estimatedMinutes,
      order: state.order,
      publishedAt: null,
    };
    try {
      const res = await fetch(`/api/admin/chapters/${chapterId}/lessons`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      const lessonId = (data as { lesson: { id: string } }).lesson.id;
      startTransition(() => router.push(`/admin/lessons/${lessonId}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-5">
        <label className="text-sm sm:col-span-2">
          <span className="block font-medium">Slug</span>
          <input
            type="text"
            required
            value={state.slug}
            onChange={(e) => setState({ ...state, slug: e.target.value })}
            placeholder="pourquoi-bitcoin"
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
      {error && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          Créer la leçon
        </button>
      </div>
    </form>
  );
}
