"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { readCookie } from "@/lib/bitquest/client";

interface ImageFieldProps {
  value: string;
  onChange: (next: string) => void;
  label: string;
  hint?: string;
  placeholder?: string;
  initialsFallback?: string;
}

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

export function ImageField({
  value,
  onChange,
  label,
  hint,
  placeholder = "https://… ou téléverser un fichier",
  initialsFallback,
}: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const trimmed = value.trim();
  const hasPreview = trimmed.length > 0;

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const csrf = readCookie("bq_csrf");
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/uploads/image", {
        method: "POST",
        credentials: "include",
        headers: csrf ? { "X-CSRF-Token": csrf } : undefined,
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.url) {
        throw new Error(data.error ?? `Erreur ${res.status}`);
      }
      onChange(data.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload échoué.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        {hint ? (
          <span className="text-xs font-normal text-muted-foreground">{hint}</span>
        ) : null}
      </div>

      <div className="flex items-start gap-3">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-xs font-semibold text-muted-foreground"
          aria-hidden
        >
          {hasPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={trimmed} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display uppercase">{initialsFallback ?? "—"}</span>
          )}
        </div>

        <div className="flex-1 space-y-1.5">
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted disabled:cursor-wait disabled:opacity-60"
            >
              {uploading ? "Téléversement…" : "Téléverser un fichier"}
            </button>
            {hasPreview ? (
              <button
                type="button"
                onClick={() => onChange("")}
                className="rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              >
                Effacer
              </button>
            ) : null}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              onChange={onFileChange}
              className="hidden"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            PNG · JPEG · WebP · GIF — max 2 Mo. Le fichier est stocké sur le serveur.
          </p>
          {uploadError ? (
            <p role="alert" className="text-[11px] text-destructive">
              {uploadError}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
