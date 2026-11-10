"use client";

import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LOCALES, type Locale } from "./config";
import { useLocale } from "./locale-provider";

/**
 * Switch de langue minimal. On cycle entre FR / EN sur clic, ce qui est
 * plus compact qu'un menu déroulant pour seulement deux options. La
 * valeur active est annoncée par aria-label et persistée par cookie.
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
