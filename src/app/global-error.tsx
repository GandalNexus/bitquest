"use client";

// Boundary d'erreur de niveau racine (Next.js App Router).
// Volontairement MINIMAL et autonome : aucun hook de contexte, aucun provider,
// aucun composant partagé avec le reste de l'app. Objectif : pouvoir s'afficher
// même si les providers (QueryClient, Theme, Toast) ont planté.

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          padding: "2rem",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          color: "#fafafa",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>
            Une erreur est survenue
          </h1>
          <p style={{ opacity: 0.75, marginBottom: "2rem" }}>
            BitQuest a rencontré un problème inattendu. Tu peux réessayer ou
            recharger la page.
          </p>
          {error.digest && (
            <p style={{ fontSize: "0.75rem", opacity: 0.5, marginBottom: "1.5rem" }}>
              Référence technique : <code>{error.digest}</code>
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "0.75rem 1.5rem",
              borderRadius: "0.5rem",
              border: "1px solid #fafafa",
              backgroundColor: "transparent",
              color: "#fafafa",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
