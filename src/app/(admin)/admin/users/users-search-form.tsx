"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Search, X } from "lucide-react";

/**
 * Barre de recherche pseudo pour `/admin/users`. Synchronise `q=` dans
 * l'URL (searchParams) ; la page SSR relit `q` et filtre via
 * Prisma `pseudo contains, mode=insensitive` (équivalent ILIKE Postgres).
 *
 * Reset la pagination (page=1) à chaque nouvelle recherche.
 */
export function UsersSearchForm({ initialQuery }: { initialQuery: string }) {
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
    startTransition(() => {
      router.push(`/admin/users?${params.toString()}`);
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
      <div className="relative flex-1 max-w-md">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un pseudo…"
          aria-label="Rechercher un pseudo"
          className="w-full rounded-md border bg-background pl-8 pr-8 py-1.5 text-sm"
        />
        {q.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Effacer la recherche"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
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
