"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { readCookie } from "@/lib/bitquest/client";

interface CourseInitial {
  id?: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  coverIcon: string;
  order: number;
  publishedAt: string | null;
}

/**
 * Formulaire partagé create / edit. En mode create (`id` absent) → POST ;
 * sinon PATCH. Le champ publishedAt est une checkbox (publié = timestamp
 * courant, non publié = null).
 */
export function CourseForm({
  initial,
  mode,
}: {
  initial: CourseInitial;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<CourseInitial>(initial);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const csrf = readCookie("bq_csrf");
    const url = mode === "create" ? "/api/admin/courses" : `/api/admin/courses/${initial.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const body = {
      slug: state.slug,
      title: state.title,
      subtitle: state.subtitle,
      description: state.description,
      coverIcon: state.coverIcon,
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
        if (mode === "create") router.push("/admin/courses");
        else router.refresh();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  const onDelete = async () => {
    if (!initial.id || !confirm("Supprimer définitivement ce cours ?")) return;
    setError(null);
    const csrf = readCookie("bq_csrf");
    try {
      const res = await fetch(`/api/admin/courses/${initial.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: csrf ? { "X-CSRF-Token": csrf } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      }
      startTransition(() => router.push("/admin/courses"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Slug" required>
          <input
            type="text"
            value={state.slug}
            onChange={(e) => setState({ ...state, slug: e.target.value })}
            placeholder="fondamentaux-bitcoin"
            required
            className="input"
          />
        </Field>
        <Field label="Ordre d'affichage" required>
          <input
            type="number"
            min={0}
            value={state.order}
            onChange={(e) => setState({ ...state, order: Number(e.target.value) || 0 })}
            className="input"
          />
        </Field>
      </div>
      <Field label="Titre" required>
        <input
          type="text"
          value={state.title}
          onChange={(e) => setState({ ...state, title: e.target.value })}
          required
          className="input"
        />
      </Field>
      <Field label="Sous-titre" required>
        <input
          type="text"
          value={state.subtitle}
          onChange={(e) => setState({ ...state, subtitle: e.target.value })}
          required
          className="input"
        />
      </Field>
      <Field label="Description" required>
        <textarea
          value={state.description}
          onChange={(e) => setState({ ...state, description: e.target.value })}
          required
          rows={5}
          className="input"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Icône Lucide">
          <input
            type="text"
            value={state.coverIcon}
            onChange={(e) => setState({ ...state, coverIcon: e.target.value })}
            placeholder="BookOpen"
            className="input"
          />
        </Field>
        <Field label="Publication">
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
            <span>{state.publishedAt ? "Publié (visible au catalogue)" : "Brouillon (caché)"}</span>
          </label>
        </Field>
      </div>

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
          <a href="/admin/courses" className="rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
            Annuler
          </a>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {mode === "create" ? "Créer le cours" : "Enregistrer"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.375rem;
          border-width: 1px;
          background-color: hsl(var(--background));
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
  );
}
