import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,

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
