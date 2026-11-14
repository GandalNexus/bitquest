"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";

/**
 * Providers globaux montés depuis `app/layout.tsx` (server component).
 *
 * - `ThemeProvider` doit vivre AU DESSUS de tout `"use client"` racine :
 *   son `<script>` anti-FOUC est rendu dans le HTML initial par le SSR
 *   (le composant est client mais appelé par un server layout, donc
 *   React Server Component fournit son balisage initial). Sinon React
 *   warn « Encountered a script tag while rendering React component »
 *   parce que le script est injecté au runtime client → jamais exécuté.
 * - `QueryClientProvider` est centralisé ici pour partager un seul
 *   cache entre tous les segments de l'app. L'instance est mémorisée
 *   par `useState(() => new …)` pour survivre aux re-renders.
 */
export function Providers({ children }: { children: ReactNode }) {
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
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
