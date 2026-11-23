// Vitest global setup — tenu léger : les tests unitaires de la Phase 0
// portent sur les fonctions pures du domain layer (src/lib/bitquest/).
// Les mocks Prisma seront ajoutés en Phase 1 pour les tests d'intégration.

// Évite les logs inutiles pendant l'exécution des tests.
if (typeof globalThis !== "undefined") {
  // Place pour les polyfills ou extensions de matchers à venir.
}

export {};
