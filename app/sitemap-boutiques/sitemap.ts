import type { MetadataRoute } from "next";
import { catalogPool } from "@/lib/db";
import { SITE_URL } from "@/lib/seo";

// /sitemap-boutiques.xml — boutiques landing pages + every per-shop product.
// Pattern: /boutiques/<shop_slug>/<product_slug>

export const revalidate = 300;

const PAGE_SIZE = 5000;

export async function generateSitemaps() {
  try {
    const r = await catalogPool().query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM products p
       JOIN shops s ON s.id = p.shop_id
       WHERE p.slug IS NOT NULL AND s.slug IS NOT NULL`
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
    const r = await catalogPool().query<{
      shop_slug: string; product_slug: string; updated_at: string | null;
    }>(
      `SELECT s.slug AS shop_slug,
              p.slug AS product_slug,
              COALESCE(p.updated_at, p.created_at) AS updated_at
       FROM products p
       JOIN shops s ON s.id = p.shop_id
       WHERE p.slug IS NOT NULL AND s.slug IS NOT NULL
       ORDER BY p.id
       OFFSET $1
       LIMIT $2`,
      [offset, PAGE_SIZE]
    );
    return r.rows.map((row) => ({
      url: `${SITE_URL}/boutiques/${row.shop_slug}/${row.product_slug}`,
      lastModified: row.updated_at ? new Date(row.updated_at) : new Date(),
      changeFrequency: "weekly",
      priority: 0.55,
    }));
  } catch {
    return [];
  }
}
