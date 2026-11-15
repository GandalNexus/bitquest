import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const revalidate = 3600;

function siteUrl(): string {
  const host = process.env.NEXT_PUBLIC_BITQUEST_HOST ?? "bitquest.local";
  return host.startsWith("http") ? host : `https://${host}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/academy`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/verify`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/gandalnexus`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  let courseEntries: MetadataRoute.Sitemap = [];
  try {
    const courses = await db.course.findMany({
      where: { publishedAt: { not: null } },
      select: { slug: true, updatedAt: true },
    });
    courseEntries = courses.map((c) => ({
      url: `${base}/academy/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
  } catch {
    courseEntries = [];
  }

  return [...staticEntries, ...courseEntries];
}
