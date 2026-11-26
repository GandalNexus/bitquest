import { db } from "@/lib/db";

const SINGLETON_ID = "singleton";

const DEFAULTS = {
  bitquestUrl: "https://bitquest.gandalnexus.com",
  bitlabUrl: "https://bitlab.gandalnexus.com",
  githubOrgUrl: "https://github.com/GandalNexus",
  verifyUrl: "https://bitquest.gandalnexus.com/verify",
};

const PUBLIC_CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-max-age": "3600",
  // Cache court côté CDN pour éviter de taper la DB à chaque visite.
  // 60s = compromis : les modifications admin sont visibles rapidement,
  // mais les visites répétées ne touchent pas la DB.
  "cache-control": "public, max-age=60, s-maxage=60",
} as const;

/**
 * GET /api/public/landing-config — consommé par la landing statique (repo
 * `landing/`) pour récupérer les URL de redirection configurées côté admin.
 *
 * Volontairement public, sans auth, CORS *. Zéro donnée sensible : juste
 * les URL publiques déjà exposées sur le site (BitQuest, BitLab, GitHub,
 * verify). Si la DB est down, on retourne les defaults codés en dur pour
 * ne jamais casser la landing.
 */
export async function GET() {
  try {
    const row = await db.landingConfig.findUnique({ where: { id: SINGLETON_ID } });
    const config = row
      ? {
          bitquestUrl: row.bitquestUrl,
          bitlabUrl: row.bitlabUrl,
          githubOrgUrl: row.githubOrgUrl,
          verifyUrl: row.verifyUrl,
        }
      : DEFAULTS;
    return Response.json(config, { headers: PUBLIC_CORS_HEADERS });
  } catch {
    // DB injoignable → fallback silencieux. La landing a ses propres defaults
    // en HTML, donc c'est une double sécurité.
    return Response.json(DEFAULTS, { headers: PUBLIC_CORS_HEADERS });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: PUBLIC_CORS_HEADERS });
}
