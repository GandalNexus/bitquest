"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";
import { useSessionHydration } from "@/lib/bitquest/hooks";

/**
 * Wrap les pages /academy/** avec les mêmes providers que l'app SPA :
 * React Query, thème, et hydratation de session depuis localStorage.
 */
function SessionBoot() {
  useSessionHydration();
  return null;
}

export function AcademyProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <SessionBoot />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
