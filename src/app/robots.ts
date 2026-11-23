import type { MetadataRoute } from "next";

function siteUrl(): string {
  const host = process.env.NEXT_PUBLIC_BITQUEST_HOST ?? "bitquest.local";
  return host.startsWith("http") ? host : `https://${host}`;
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/academy", "/verify", "/gandalnexus"],
        disallow: ["/api/", "/admin", "/admin/", "/dashboard", "/profile", "/attestations", "/wallet"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
