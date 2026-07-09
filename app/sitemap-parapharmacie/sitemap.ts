import type { MetadataRoute } from "next";
import { paraPool } from "@/lib/db";
import { SITE_URL } from "@/lib/seo";

// /sitemap-parapharmacie.xml — every parapharmacie product slug.

export const revalidate = 300;

const PAGE_SIZE = 5000;

export async function generateSitemaps() {
  try {
    const r = await paraPool().query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM products WHERE slug IS NOT NULL`
    );
    const total = parseInt(r.rows[0]?.c ?? "0", 10) || 0;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    return Array.from({ length: pages }, (_, id) => ({ id }));
  } catch {
    return [{ id: 0 }];
  }
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  try {
    const offset = id * PAGE_SIZE;
    const r = await paraPool().query<{ slug: string; updated_at: string }>(
      `SELECT slug, updated_at
       FROM products
       WHERE slug IS NOT NULL
       ORDER BY id
       OFFSET $1
       LIMIT $2`,
      [offset, PAGE_SIZE]
    );
    return r.rows.map((row) => ({
      url: `${SITE_URL}/parapharmacie/${row.slug}`,
      lastModified: row.updated_at ? new Date(row.updated_at) : new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    }));
  } catch {
    return [];
  }
}
