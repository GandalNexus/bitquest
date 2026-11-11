"use client";

import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LOCALES, type Locale } from "./config";
import { useLocale } from "./locale-provider";

/**
 * Switch de langue cyclique. À 3 locales (fr/en/wo) on reste sur un
 * clic unique qui avance dans l'ordre : fr → en → wo → fr. Le menu
 * dropdown viendra si on passe à 4+ locales. La valeur active est
 * annoncée par aria-label et persistée par cookie.
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();

  const next: Locale = LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length];
  const label = t("locale.switch.label");

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLocale(next)}
      aria-label={`${label} : ${locale.toUpperCase()} → ${next.toUpperCase()}`}
      className={className}
    >
      <Globe className="h-4 w-4" aria-hidden />
      <span className="font-mono text-xs">{locale.toUpperCase()}</span>
    </Button>
  );
}
