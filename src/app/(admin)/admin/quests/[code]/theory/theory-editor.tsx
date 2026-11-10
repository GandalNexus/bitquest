"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { readCookie } from "@/lib/bitquest/client";

interface Section {
  title: string;
  body: string;
  keypoints: string[];
}

const EMPTY_SECTION: Section = { title: "", body: "", keypoints: [] };

/**
 * Éditeur des sections théoriques d'une quête. Le serveur remplace
 * l'intégralité du tableau à chaque save (PATCH bulk) — pas d'édition
 * granulaire par section.
 */
export function TheoryEditor({
  code,
  initial,
}: {
  code: string;
  initial: Section[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [sections, setSections] = useState<Section[]>(
    initial.length > 0 ? initial : [{ ...EMPTY_SECTION }],
  );

  const updateSection = (idx: number, patch: Partial<Section>) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
    setSaved(false);
  };

  const addSection = () => {
    setSections((prev) => [...prev, { ...EMPTY_SECTION }]);
    setSaved(false);
  };

  const removeSection = (idx: number) => {
    if (sections.length === 1) {
      setError("Impossible de retirer la dernière section (minimum 1).");
      return;
    }
    if (!confirm(`Supprimer la section ${idx + 1} ?`)) return;
    setSections((prev) => prev.filter((_, i) => i !== idx));
    setSaved(false);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    setSections((prev) => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setSaved(false);
  };

  const updateKeypoint = (sectionIdx: number, kpIdx: number, value: string) => {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sectionIdx
          ? { ...s, keypoints: s.keypoints.map((k, j) => (j === kpIdx ? value : k)) }
          : s,
      ),
    );
    setSaved(false);
  };

  const addKeypoint = (sectionIdx: number) => {
    setSections((prev) =>
      prev.map((s, i) => (i === sectionIdx ? { ...s, keypoints: [...s.keypoints, ""] } : s)),
    );
    setSaved(false);
  };

  const removeKeypoint = (sectionIdx: number, kpIdx: number) => {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sectionIdx ? { ...s, keypoints: s.keypoints.filter((_, j) => j !== kpIdx) } : s,
      ),
    );
    setSaved(false);
  };

  const onSave = async () => {
    setError(null);
    setSaved(false);
    // Nettoyage client-side : supprime les keypoints vides pour éviter les 400 Zod
    const cleaned = sections.map((s) => ({
      ...s,
      keypoints: s.keypoints.map((k) => k.trim()).filter((k) => k.length > 0),
    }));
    const csrf = readCookie("bq_csrf");
    try {
      const res = await fetch(`/api/admin/quests/${code}/theory`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: JSON.stringify({ sections: cleaned }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? `Erreur ${res.status}`);
      }
      setSaved(true);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sections.length} section{sections.length > 1 ? "s" : ""} — chaque bloc contient un
          titre, un corps Markdown et une liste de points clés.
        </p>
        <button
          type="button"
          onClick={addSection}
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-sm text-primary hover:bg-primary/20"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Ajouter une section
        </button>
      </div>

      <ol className="space-y-6" aria-label="Sections théoriques">
        {sections.map((s, idx) => (
          <li key={idx} className="rounded-xl border bg-background/60 p-4">
            <header className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Section {idx + 1} / {sections.length}
              </h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  aria-label="Monter la section"
                  className="rounded-md border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
                >
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === sections.length - 1}
                  aria-label="Descendre la section"
                  className="rounded-md border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => removeSection(idx)}
                  aria-label="Supprimer la section"
                  className="rounded-md border border-destructive/40 p-1.5 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </header>

            <label className="block text-sm">
              <span className="block font-medium">Titre</span>
              <input
                type="text"
                value={s.title}
                onChange={(e) => updateSection(idx, { title: e.target.value })}
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="block font-medium">Corps (Markdown)</span>
              <textarea
                rows={8}
                value={s.body}
                onChange={(e) => updateSection(idx, { body: e.target.value })}
                className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 font-mono text-xs"
              />
            </label>

            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium">Points clés ({s.keypoints.length})</span>
                <button
                  type="button"
                  onClick={() => addKeypoint(idx)}
                  className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                >
                  + point
                </button>
              </div>
              {s.keypoints.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun point clé.</p>
              ) : (
                <ul className="space-y-1">
                  {s.keypoints.map((k, j) => (
                    <li key={j} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={k}
                        onChange={(e) => updateKeypoint(idx, j, e.target.value)}
                        className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeKeypoint(idx, j)}
                        aria-label="Supprimer ce point"
                        className="rounded-md border border-destructive/40 p-1 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {saved && !error && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
          Sections enregistrées.
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          Enregistrer toutes les sections
        </button>
      </div>
    </div>
  );
}
