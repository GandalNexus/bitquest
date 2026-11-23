"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { readCookie } from "@/lib/bitquest/client";
import { useContentBasePath } from "@/lib/admin/base-path";
import { PendingButton } from "@/components/ui/pending-button";

interface ChapterOption {
  id: string;
  title: string;
  slug: string;
  courseTitle: string;
}

export function NewLessonForm({
  chapters,
  initialChapterId,
}: {
  chapters: ChapterOption[];
  initialChapterId: string;
}) {
  const router = useRouter();
  const basePath = useContentBasePath();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState({
    chapterId: initialChapterId,
    slug: "",
    title: "",
    summary: "",
    estimatedMinutes: 5,
    order: 0,
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!state.chapterId) {
      setError("Sélectionne un chapitre parent.");
      return;
    }
    const csrf = readCookie("bq_csrf");
    try {
      const res = await fetch(`/api/admin/chapters/${state.chapterId}/lessons`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({
          slug: state.slug,
          title: state.title,
          summary: state.summary,
          content: "## Nouvelle leçon\n\nÉcris le contenu Markdown ici.",
          estimatedMinutes: state.estimatedMinutes,
          order: state.order,
          publishedAt: null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      }
      const lessonId = (data as { lesson: { id: string } }).lesson.id;
      startTransition(() => router.push(`${basePath}/lessons/${lessonId}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">
          Chapitre parent <span className="text-destructive">*</span>
        </span>
        <select
          required
          value={state.chapterId}
          onChange={(e) => setState({ ...state, chapterId: e.target.value })}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">— Sélectionner —</option>
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.courseTitle} · {c.title}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-5">
        <label className="block space-y-1 text-sm sm:col-span-3">
          <span className="font-medium">
            Slug <span className="text-destructive">*</span>
          </span>
          <input
            type="text"
            required
            value={state.slug}
            onChange={(e) => setState({ ...state, slug: e.target.value })}
            placeholder="pourquoi-bitcoin"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Minutes</span>
          <input
            type="number"
            min={1}
            value={state.estimatedMinutes}
            onChange={(e) => setState({ ...state, estimatedMinutes: Number(e.target.value) || 5 })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Ordre</span>
          <input
            type="number"
            min={0}
            value={state.order}
            onChange={(e) => setState({ ...state, order: Number(e.target.value) || 0 })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">
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
      <label className="block space-y-1 text-sm">
        <span className="font-medium">
          Résumé <span className="text-destructive">*</span>
        </span>
        <input
          type="text"
          required
          value={state.summary}
          onChange={(e) => setState({ ...state, summary: e.target.value })}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </label>
      {error && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="flex items-center justify-end gap-2 pt-2">
        <a
          href={`${basePath}/lessons`}
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
          Créer la leçon
        </PendingButton>
      </div>
    </form>
  );
}
