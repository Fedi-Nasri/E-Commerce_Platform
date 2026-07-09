import { alimentPool, paraPool, retailPool } from "@/lib/db";
import { RETAIL_PAGE_CARDS, retailPageCardSlug } from "@/lib/retailCategories";
import type { Pool } from "pg";

export type HomeCategoryCounts = Record<string, number>;

async function countRetailBySlugs(slugs: string[]): Promise<number> {
  if (!slugs.length) return 0;
  const pool = retailPool();
  const res = await pool.query<{ total: string }>(
    `SELECT COUNT(DISTINCT p.id)::text AS total
     FROM products p
     WHERE p.status = 'active'
       AND EXISTS (
       SELECT 1
       FROM product_subcategories psc
       JOIN subcategories sc ON sc.id = psc.subcategory_id
       JOIN low_categories lc ON lc.id = sc.low_category_id
       JOIN top_categories tc ON tc.id = lc.top_category_id
       WHERE psc.product_id = p.id
         AND (
           tc.slug = ANY($1::text[])
           OR lc.slug = ANY($1::text[])
           OR sc.slug = ANY($1::text[])
         )
     )`,
    [slugs]
  );
  return parseInt(res.rows[0]?.total ?? "0", 10) || 0;
}

async function countCatalogProducts(pool: Pool): Promise<number> {
  const res = await pool.query<{ total: string }>(
    `SELECT COUNT(DISTINCT p.id)::text AS total
     FROM products p
     JOIN shop_prices sp ON sp.product_id = p.id`
  );
  return parseInt(res.rows[0]?.total ?? "0", 10) || 0;
}

/** Live product counts for homepage « Comparez par catégorie » cards. */
export async function getHomeCategoryCounts(): Promise<HomeCategoryCounts> {
  const retailCounts = await Promise.all(
    RETAIL_PAGE_CARDS.map(async (card) => {
      const slugs = retailPageCardSlug(card.topId)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const count = await countRetailBySlugs(slugs);
      return [card.topId, count] as const;
    })
  );

  const [superCount, paraCount] = await Promise.all([
    countCatalogProducts(alimentPool()).catch(() => 0),
    countCatalogProducts(paraPool()).catch(() => 0),
  ]);

  return {
    ...Object.fromEntries(retailCounts),
    supermarche: superCount,
    parapharmacie: paraCount,
  };
}
