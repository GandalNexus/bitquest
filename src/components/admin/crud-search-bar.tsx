"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Search, X } from "lucide-react";

/**
 * Barre de recherche générique pour les listes admin/studio (Courses,
 * Chapters, Lessons, Challenges…). Synchronise `q=` dans l'URL ; la
 * page SSR relit le paramètre et filtre côté Prisma via
 * `contains, mode: "insensitive"` (ILIKE Postgres).
 *
 * Reset la pagination (`page=1`) à chaque nouvelle recherche.
 */
export function CrudSearchBar({
  initialQuery,
  placeholder,
  ariaLabel,
}: {
  initialQuery: string;
  placeholder: string;
  ariaLabel: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQuery);
  const [pending, startTransition] = useTransition();

  const applyQuery = (value: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    const trimmed = value.trim();
    if (trimmed.length === 0) params.delete("q");
    else params.set("q", trimmed);
    params.delete("page");
    const qs = params.toString();
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    startTransition(() => {
      router.push(qs.length > 0 ? `${path}?${qs}` : path);
    });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    applyQuery(q);
  };

  const onClear = () => {
    setQ("");
    applyQuery("");
  };

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <div className="relative max-w-md flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="w-full rounded-md border bg-background py-1.5 pr-8 pl-8 text-sm"
        />
        {q.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Effacer la recherche"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-60"
      >
        Rechercher
      </button>
    </form>
  );
}
