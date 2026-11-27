import { db } from "@/lib/db";

// Next 16 revalide la route toutes les 60s (aligné sur le cache CDN
// annoncé via `cache-control`). Sans ça, le route handler serait rendu
// statique au build et les modifications admin ne seraient jamais vues.
export const revalidate = 60;

const SINGLETON_ID = "singleton";

const DEFAULT_URLS = {
  bitquestUrl: "https://bitquest.gandalnexus.com",
  bitlabUrl: "https://bitlab.gandalnexus.com",
  landingUrl: "https://gandalnexus.com",
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
 * `landing/`) pour récupérer les URL de redirection + les membres d'équipe
 * + les sponsors/partenaires configurés côté admin.
 *
 * Volontairement public, sans auth, CORS *. Zéro donnée sensible : tout
 * ce qui est retourné est déjà exposé publiquement sur `/gandalnexus`.
 *
 * Si la DB est down, on retourne un payload minimal avec juste les URL
 * defaults — pour que la landing statique ne casse jamais, elle a elle
 * aussi ses propres defaults en HTML (double sécurité).
 */
export async function GET() {
  try {
    const [row, teamRows, partnerRows] = await Promise.all([
      db.landingConfig.findUnique({ where: { id: SINGLETON_ID } }),
      db.teamMember.findMany({
        where: { publishedAt: { not: null } },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          role: true,
          contribution: true,
          initials: true,
          avatarUrl: true,
        },
        take: 20,
      }),
      db.partner.findMany({
        where: { publishedAt: { not: null } },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          tier: true,
          description: true,
          websiteUrl: true,
          logoUrl: true,
          initials: true,
        },
        take: 30,
      }),
    ]);

    const payload = {
      ...(row
        ? {
            bitquestUrl: row.bitquestUrl,
            bitlabUrl: row.bitlabUrl,
            landingUrl: row.landingUrl,
            githubOrgUrl: row.githubOrgUrl,
            verifyUrl: row.verifyUrl,
            contactEmail: row.contactEmail,
            twitterUrl: row.twitterUrl,
            nostrPubkey: row.nostrPubkey,
            docsUrl: row.docsUrl,
          }
        : {
            ...DEFAULT_URLS,
            contactEmail: null,
            twitterUrl: null,
            nostrPubkey: null,
            docsUrl: null,
          }),
      team: teamRows,
      partners: partnerRows,
    };

    return Response.json(payload, { headers: PUBLIC_CORS_HEADERS });
  } catch {
    // DB injoignable → payload minimal, la landing a ses propres defaults.
    return Response.json(
      {
        ...DEFAULT_URLS,
        contactEmail: null,
        twitterUrl: null,
        nostrPubkey: null,
        docsUrl: null,
        team: [],
        partners: [],
      },
      { headers: PUBLIC_CORS_HEADERS },
    );
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: PUBLIC_CORS_HEADERS });
}
