

import { alimentPool, paraPool, retailPool } from "@/lib/db";

export type SeoProduct = {
  name: string;
  brand: string | null;
  image: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  shopName: string | null;
};

type Pool = ReturnType<typeof alimentPool>;

async function lookup(pool: Pool, slug: string): Promise<SeoProduct | null> {
  try {
    const r = await pool.query<{
      name: string;
      brand: string | null;
      image: string | null;
      min_price: string | null;
      max_price: string | null;
      shop: string | null;
    }>(
      `SELECT p.name,
              b.name AS brand,
              (
                SELECT image_url FROM product_images
                WHERE product_id = p.id AND image_url ~ '^https?://'
                ORDER BY id ASC LIMIT 1
              ) AS image,
              MIN(sp.current_price)::text AS min_price,
              MAX(sp.current_price)::text AS max_price,
              (
                SELECT s.name FROM shop_prices sp2
                JOIN shops s ON s.id = sp2.shop_id
                WHERE sp2.product_id = p.id AND sp2.current_price > 0
                ORDER BY sp2.current_price ASC LIMIT 1
              ) AS shop
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN shop_prices sp ON sp.product_id = p.id AND sp.current_price > 0
       WHERE p.slug = $1 AND p.status = 'active'
       GROUP BY p.id, b.name
       LIMIT 1`,
      [slug]
    );
    if (!r.rows.length) return null;
    const row = r.rows[0];
    return {
      name: row.name,
      brand: row.brand,
      image: row.image,
      minPrice: row.min_price != null ? parseFloat(row.min_price) : null,
      maxPrice: row.max_price != null ? parseFloat(row.max_price) : null,
      shopName: row.shop,
    };
  } catch {
    return null;
  }
}

export const lookupSupermarcheProduct = (slug: string) => lookup(alimentPool(), slug);
export const lookupParaProduct        = (slug: string) => lookup(paraPool(), slug);
export const lookupRetailProduct      = (slug: string) => lookup(retailPool(), slug);

// Boutiques (legacy catalog) has a different schema: one row per shop-product
// with the price/image/brand on the products row itself.
import { catalogPool } from "@/lib/db";

export type SeoBoutiqueProduct = SeoProduct & { shopSlug: string | null };

export async function lookupBoutiqueProduct(
  shopSlug: string,
  slug: string
): Promise<SeoBoutiqueProduct | null> {
  try {
    const r = await catalogPool().query<{
      name: string; brand: string | null; image: string | null;
      price: string | null; shop_name: string | null; shop_slug: string | null;
    }>(
      `SELECT p.name, p.brand, p.image, p.price::text AS price,
              s.name AS shop_name, s.slug AS shop_slug
       FROM products p
       JOIN shops s ON s.id = p.shop_id
       WHERE p.slug = $1
         AND (s.slug = $2 OR s.shop_key = $2)
       ORDER BY p.price ASC NULLS LAST
       LIMIT 1`,
      [slug, shopSlug]
    );
    if (!r.rows.length) return null;
    const row = r.rows[0];
    const price = row.price != null ? parseFloat(row.price) : null;
    return {
      name: row.name,
      brand: row.brand,
      image: row.image,
      minPrice: price,
      maxPrice: price,
      shopName: row.shop_name,
      shopSlug: row.shop_slug,
    };
  } catch {
    return null;
  }
}
