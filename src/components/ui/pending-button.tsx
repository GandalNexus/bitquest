"use client";

import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Bouton standard pour les actions CRUD : affiche un spinner et un label
 * dynamique quand `pending=true`, et devient non-cliquable automatiquement.
 *
 * Wrapper minimal sur un <button> HTML (sans dépendance au composant Button
 * shadcn) parce que les formulaires CRUD admin utilisent déjà des styles
 * tailwind inline → pas de breakage visuel.
 */
interface PendingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pending: boolean;
  /** Label affiché quand `pending` est `false`. */
  children: ReactNode;
  /** Label affiché quand `pending` est `true`. Default : "Enregistrement…". */
  pendingLabel?: ReactNode;
}

export const PendingButton = forwardRef<HTMLButtonElement, PendingButtonProps>(
  function PendingButton(
    { pending, children, pendingLabel, className, disabled, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        {...rest}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
      >
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
        {pending ? (pendingLabel ?? "Enregistrement…") : children}
      </button>
    );
  },
);
