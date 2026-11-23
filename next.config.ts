import type { NextConfig } from "next";

/**
 * Headers de sécurité HTTP appliqués à toutes les routes (LOT 82).
 *
 * Choix v1 :
 * - Pas de CSP strict — Next.js injecte des scripts/styles inline pour
 *   l'hydration et Tailwind : un CSP sans nonce casserait le rendu.
 *   Un durcissement CSP avec nonce est tracké pour un LOT futur.
 * - HSTS activé uniquement en production (préserver http://localhost:3000).
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

  // LOT 71 : NIP-11 /.well-known/nostr.json servi par la route
  // /api/nostr-json (Next.js n'aime pas les dossiers commençant par
  // un point dans src/app).
  async rewrites() {
    return [
      {
        source: "/.well-known/nostr.json",
        destination: "/api/nostr-json",
      },
    ];
  },
};

export default nextConfig;
