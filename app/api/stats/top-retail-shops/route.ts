import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.RETAIL_DB_URL, max: 2 });

export const dynamic = "force-dynamic";

const LOGO_FILES: Record<string, string | null> = {
  tunisianet: "/shop-logos/tunisianet.jpg",
  mytek: "/shop-logos/mytek.png",
  spacenet: "/shop-logos/spacenet.svg",
  megapc: "/shop-logos/megapc.png",
  agora: "/shop-logos/agora.png",
  wiki: "/shop-logos/wiki.png",
  jumbo: "/shop-logos/jumbo.jpg",
  bstech: "/shop-logos/bstech.webp",
  kamounhome: "/shop-logos/kamounhome.png",
  technopro: "/shop-logos/technopro.jpg",
  affariyet: "/shop-logos/affariyet.webp",
  krichen: "/shop-logos/krichen.png",
  maalejaudio: "/shop-logos/maalejaudio.png",
  graiet: "/shop-logos/graiet.png",
  electrohadjkacem: "/shop-logos/electrohadjkacem.svg",
  electrochaabani: "/shop-logos/electrochaabani.png",
};

function logoFor(key: string): string | null {
  if (key in LOGO_FILES) return LOGO_FILES[key];
  return `/shop-logos/${key}.png`;
}

function displayName(key: string): string {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export async function GET() {
  const client = await pool.connect();
  try {
    // Top 5 shops by cheapest_count (number of products where they have the best price)
    // Only matched products (is_matched=true) for accuracy
    const res = await client.query(`
      WITH shop_stats AS (
        SELECT
          s.shop_key,
          s.name                                          AS display_name,
          COUNT(DISTINCT sp.product_id)                   AS total_products,
          -- cheapest: shop has the lowest current_price for that product
          COUNT(DISTINCT CASE
            WHEN sp.current_price = (
              SELECT MIN(sp2.current_price)
              FROM shop_prices sp2
              WHERE sp2.product_id = sp.product_id
                AND sp2.current_price IS NOT NULL
            ) THEN sp.product_id
          END)                                            AS cheapest_count
        FROM shops s
        JOIN shop_prices sp ON sp.shop_id = s.id
        JOIN products p ON p.id = sp.product_id
        WHERE p.is_matched = true
          AND p.status = 'active'
          AND sp.current_price IS NOT NULL
        GROUP BY s.id, s.shop_key, s.name
        HAVING COUNT(DISTINCT sp.product_id) >= 10
        ORDER BY cheapest_count DESC
        LIMIT 5
      )
      SELECT
        ss.shop_key,
        ss.display_name,
        ss.total_products,
        ss.cheapest_count,
        -- similar: products this shop carries that at least one OTHER top-5 also carries
        (
          SELECT COUNT(DISTINCT sp3.product_id)
          FROM shop_prices sp3
          JOIN shops s3 ON s3.id = sp3.shop_id
          WHERE sp3.product_id IN (
            SELECT sp4.product_id FROM shop_prices sp4
            JOIN shops s4 ON s4.id = sp4.shop_id
            WHERE s4.shop_key = ss.shop_key
          )
          AND s3.shop_key != ss.shop_key
          AND s3.shop_key IN (SELECT shop_key FROM shop_stats)
        )                                                 AS similar_products
      FROM shop_stats ss
      ORDER BY ss.cheapest_count DESC
    `);

    const shops = res.rows.map(r => ({
      shop: r.shop_key,
      displayName: displayName(r.shop_key),
      logo: logoFor(r.shop_key),
      totalProducts: Number(r.total_products),
      similarProducts: Number(r.similar_products),
      cheapestCount: Number(r.cheapest_count),
    }));

    return NextResponse.json({ shops });
  } finally {
    client.release();
  }
}
