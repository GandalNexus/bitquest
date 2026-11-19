"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { readCookie } from "@/lib/bitquest/client";
import { useContentBasePath } from "@/lib/admin/base-path";
import { PendingButton } from "@/components/ui/pending-button";

interface CourseOption {
  id: string;
  title: string;
  slug: string;
}

export function NewChapterForm({
  courses,
  initialCourseId,
}: {
  courses: CourseOption[];
  initialCourseId: string;
}) {
  const router = useRouter();
  const basePath = useContentBasePath();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState({
    courseId: initialCourseId,
    slug: "",
    title: "",
    summary: "",
    order: 0,
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!state.courseId) {
      setError("Sélectionne un cours parent.");
      return;
    }
    const csrf = readCookie("bq_csrf");
    try {
      const res = await fetch(`/api/admin/courses/${state.courseId}/chapters`, {
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
          order: state.order,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      }
      const chapterId = (data as { chapter: { id: string } }).chapter.id;
      startTransition(() => router.push(`${basePath}/chapters/${chapterId}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">
          Cours parent <span className="text-destructive">*</span>
        </span>
        <select
          required
          value={state.courseId}
          onChange={(e) => setState({ ...state, courseId: e.target.value })}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">— Sélectionner —</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} ({c.slug})
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">
            Slug <span className="text-destructive">*</span>
          </span>
          <input
            type="text"
            required
            value={state.slug}
            onChange={(e) => setState({ ...state, slug: e.target.value })}
            placeholder="propriete-numerique"
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
          href={`${basePath}/chapters`}
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
          Créer le chapitre
        </PendingButton>
      </div>
    </form>
  );
}
