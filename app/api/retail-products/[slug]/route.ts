import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { nameSimilarityScore, resolveDetailPriceHistory } from "@/lib/productDetail";

const pool = new Pool({ connectionString: process.env.RETAIL_DB_URL, max: 3 });

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const { slug } = params;
  const client = await pool.connect();
  try {
    const headRes = await client.query(
      `SELECT
         p.id, p.name, p.slug, p.source_product_id,
         b.name AS brand,
         tc.name AS category,
         sc.name AS subcategory,
         lc.name AS low_category,
         (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.image_url NOT ILIKE '%yatoo.com.tn%' ORDER BY pi.id ASC LIMIT 1) AS img
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN product_subcategories psc ON psc.product_id = p.id
       LEFT JOIN subcategories sc ON sc.id = psc.subcategory_id
       LEFT JOIN low_categories lc ON lc.id = sc.low_category_id
       LEFT JOIN top_categories tc ON tc.id = lc.top_category_id
       WHERE p.slug = $1 AND p.status = 'active'
       LIMIT 1`,
      [slug]
    );

    if (headRes.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const head = headRes.rows[0];

    const [imagesRes, pricesRes, historyRes, relatedRes, specsRes] = await Promise.all([
      client.query(
        `SELECT pi.image_url FROM product_images pi WHERE pi.product_id = $1 AND pi.image_url NOT ILIKE '%yatoo.com.tn%' ORDER BY pi.id ASC`,
        [head.id]
      ),
      client.query(
        `SELECT s.shop_key, s.name AS shop_name, sp.shop_product_url, sp.current_price
         FROM shop_prices sp
         JOIN shops s ON s.id = sp.shop_id
         WHERE sp.product_id = $1
         ORDER BY sp.current_price ASC`,
        [head.id]
      ),
      client.query(
        `SELECT DATE(ph.recorded_at) AS date, MIN(ph.price) AS prix
         FROM price_history ph
         WHERE ph.product_id = $1
           AND ph.recorded_at >= NOW() - INTERVAL '90 days'
         GROUP BY DATE(ph.recorded_at)
         ORDER BY DATE(ph.recorded_at) ASC`,
        [head.id]
      ),
      client.query(
        `SELECT p2.name, p2.slug,
           b2.name AS brand,
           tc2.name AS category,
           sc2.name AS subcategory,
           MIN(sp2.current_price) AS min_price,
           MAX(sp2.current_price) AS max_price,
           (SELECT pi2.image_url FROM product_images pi2 WHERE pi2.product_id = p2.id AND pi2.image_url NOT ILIKE '%yatoo.com.tn%' ORDER BY pi2.id LIMIT 1) AS img,
           array_agg(DISTINCT s2.shop_key) AS shop_keys,
           MAX(CASE WHEN sc2.name IS NOT DISTINCT FROM $3 THEN 1 ELSE 0 END) AS sub_match,
           MAX(CASE WHEN lc2.name IS NOT DISTINCT FROM $4 THEN 1 ELSE 0 END) AS low_match,
           MAX(CASE WHEN b2.name IS NOT DISTINCT FROM $5 THEN 1 ELSE 0 END) AS brand_match
         FROM products p2
         LEFT JOIN brands b2 ON b2.id = p2.brand_id
         LEFT JOIN product_subcategories psc2 ON psc2.product_id = p2.id
         LEFT JOIN subcategories sc2 ON sc2.id = psc2.subcategory_id
         LEFT JOIN low_categories lc2 ON lc2.id = sc2.low_category_id
         LEFT JOIN top_categories tc2 ON tc2.id = lc2.top_category_id
         LEFT JOIN shop_prices sp2 ON sp2.product_id = p2.id
         LEFT JOIN shops s2 ON s2.id = sp2.shop_id
         WHERE p2.id != $2
           AND p2.status = 'active'
           AND (
             sc2.name IS NOT DISTINCT FROM $3
             OR lc2.name IS NOT DISTINCT FROM $4
             OR tc2.name IS NOT DISTINCT FROM $1
           )
         GROUP BY p2.id, p2.name, p2.slug, b2.name, tc2.name, sc2.name
         ORDER BY sub_match DESC, low_match DESC, brand_match DESC, MIN(sp2.current_price) ASC
         LIMIT 18`,
        [head.category, head.id, head.subcategory, head.low_category, head.brand]
      ),
      client.query(
        `SELECT ps.spec_key, ps.spec_value
         FROM product_specs ps
         WHERE ps.product_id = $1
           AND ps.spec_key NOT IN ('data_quality_score', 'shop_count')
         ORDER BY ps.id ASC`,
        [head.id]
      ),
    ]);

    const specs: Record<string, string> = {};
    for (const row of specsRes.rows) {
      if (row.spec_key && row.spec_value) specs[row.spec_key] = row.spec_value;
    }

    const images = imagesRes.rows.map((r) => r.image_url).filter(Boolean);
    const shopUrls: Record<string, string> = {};
    const shopPrices: Record<string, number> = {};
    const shopNames: string[] = [];
    let minPrice: number | null = null;
    let maxPrice: number | null = null;

    for (const row of pricesRes.rows) {
      const price = parseFloat(row.current_price);
      const url = row.shop_product_url;
      shopPrices[row.shop_key] = price;
      shopPrices[row.shop_name] = price;
      if (url) { shopUrls[row.shop_key] = url; shopUrls[row.shop_name] = url; }
      shopNames.push(row.shop_key);
      if (minPrice === null || price < minPrice) minPrice = price;
      if (maxPrice === null || price > maxPrice) maxPrice = price;
    }

    const rawHistory = historyRes.rows.map((r) => ({
      date: new Date(r.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
      prix: parseFloat(r.prix),
    }));
    const priceHistory = resolveDetailPriceHistory(rawHistory, minPrice);

    const scored = relatedRes.rows
      .map((r) => ({
        name: r.name,
        slug: r.slug,
        brand: r.brand ?? "",
        category: r.category ?? "",
        img: r.img ?? null,
        minPrice: r.min_price ? parseFloat(r.min_price) : null,
        maxPrice: r.max_price ? parseFloat(r.max_price) : null,
        shopNames: r.shop_keys ?? [],
        discount: null,
        _score: nameSimilarityScore(head.name, r.name),
      }))
      .filter((r) => r._score > 0)
      .sort((a, b) => b._score - a._score);

    const relatedSource = scored.length >= 3
      ? scored
      : relatedRes.rows.map((r) => ({
          name: r.name,
          slug: r.slug,
          brand: r.brand ?? "",
          category: r.category ?? "",
          img: r.img ?? null,
          minPrice: r.min_price ? parseFloat(r.min_price) : null,
          maxPrice: r.max_price ? parseFloat(r.max_price) : null,
          shopNames: r.shop_keys ?? [],
          discount: null,
          _score: 0,
        }));

    const related = relatedSource
      .slice(0, 6)
      .map(({ _score: _, ...rest }) => rest);

    return NextResponse.json({
      name: head.name,
      slug: head.slug,
      brand: head.brand ?? "",
      category: head.category ?? "",
      img: head.img ?? null,
      minPrice,
      maxPrice,
      shopNames,
      discount: null,
      reference: head.source_product_id ?? null,
      description: null,
      images,
      specs,
      shopUrls,
      shopPrices,
      priceHistory,
      related,
    });
  } finally {
    client.release();
  }
}
