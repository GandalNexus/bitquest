import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale, normalizeLocale } from "./config";

/**
 * Lecture de la locale côté Server Component. On lit le cookie `bq_locale`
 * via next/headers.cookies(). Si absent, fallback DEFAULT_LOCALE.
 */
export async function getServerLocale(): Promise<Locale> {
  const store = await cookies();
  return normalizeLocale(store.get(LOCALE_COOKIE)?.value);
}
