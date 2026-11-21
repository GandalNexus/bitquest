import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * ESLint est utilisé en complément d'oxlint.
 *
 * Stratégie :
 *  - oxlint (Rust, ultra-rapide) : règles JS/TS générales + React + unicorn
 *    → voir oxlint.json
 *  - ESLint (ici) : règles spécifiques à Next.js, TS avancé, et règles
 *    que oxlint ne couvre pas encore.
 *
 * Les règles déjà gérées par oxlint sont désactivées ici pour éviter
 * les doublons et garder ESLint rapide.
 */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // ── Règles gérées par oxlint — désactivées ici ───────────────────
      "no-debugger": "off",
      "no-var": "off",
      "prefer-const": "off",
      "no-unused-vars": "off",
      eqeqeq: "off",

      // ── TypeScript (délégué à oxlint / tsc) ─────────────────────────
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/prefer-as-const": "off",

      // ── React (base gérée par oxlint) ────────────────────────────────
      "react-hooks/exhaustive-deps": "warn", // gardé : utile pour éviter les bugs silencieux
      "react-hooks/immutability": "off", // React Compiler strictness — pas adopté dans le projet
      "react-hooks/set-state-in-effect": "off", // Idem — pattern largement répandu dans le code existant
      "react/no-unescaped-entities": "off",
      "react/display-name": "off",
      "react/prop-types": "off",
      "react-compiler/react-compiler": "off",

      // ── Next.js — activer les plus utiles ────────────────────────────
      "@next/next/no-img-element": "warn", // préférer next/image
      "@next/next/no-html-link-for-pages": "off",

      // ── Règles JS bruitées mais peu utiles ───────────────────────────
      "no-console": "off",
      "no-empty": "off",
      "no-irregular-whitespace": "off",
      "no-case-declarations": "off",
      "no-fallthrough": "off",
      "no-mixed-spaces-and-tabs": "off",
      "no-redeclare": "off",
      "no-undef": "off",
      "no-unreachable": "off",
      "no-useless-escape": "off",
      "@typescript-eslint/no-unused-disable-directive": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "examples/**",
      "skills",
      "prisma/**",
    ],
  },
];

export default eslintConfig;
