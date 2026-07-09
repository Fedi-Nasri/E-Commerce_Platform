import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { productCoverImageFilterSql, productCoverImageOrderSql, productCoverImageSql } from "@/lib/productImages";
import { nameSimilarityScore, resolveDetailPriceHistory } from "@/lib/productDetail";


export const revalidate = 300;

const pool = new Pool({
  connectionString: process.env.ALIMENTATION_DB_URL,
  max: 5,
});

function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { rows } = await pool.query<{
      id: number;
      name: string;
      brand: string;
      img: string;
      min_price: string;
      max_price: string;
      shop_names: string[];
    }>(`
      SELECT
        p.id,
        p.name,
        COALESCE(b.name, '') AS brand,
        MIN(sp.current_price) AS min_price,
        MAX(sp.current_price) AS max_price,
        ${productCoverImageSql("p.id")} AS img,
        array_agg(DISTINCT s.name ORDER BY s.name) AS shop_names
      FROM products p
      LEFT JOIN brands b ON b.id = p.brand_id
      JOIN shop_prices sp ON sp.product_id = p.id
      JOIN shops s ON s.id = sp.shop_id
      GROUP BY p.id, p.name, b.name
    `);

    const product = rows.find(r => toSlug(r.name) === params.slug);
    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const minPrice = parseFloat(product.min_price) || 0;
    const maxPrice = parseFloat(product.max_price) || 0;
    const discount =
      maxPrice > minPrice
        ? Math.round((1 - minPrice / maxPrice) * 100)
        : null;

    // Fetch per-shop URLs/prices, all images, and source reference
    const client = await pool.connect();
    let shopUrls: Record<string, string> = {};
    let shopPrices: Record<string, number> = {};
    let images: string[] = [];
    let reference: string | null = null;
    let priceHistory: { date: string; prix: number }[] = [];
    let specs: Record<string, string> = {};
    let related: {
      name: string;
      brand: string;
      img: string;
      minPrice: number;
      slug: string;
      discount: number | null;
    }[] = [];
    try {
      const [pricesRes, imagesRes, refRes, histRes, headMetaRes, relatedRes, specsRes] = await Promise.all([
        client.query(
          `SELECT s.shop_key, s.name AS shop_name, sp.shop_product_url, sp.current_price
           FROM products p
           JOIN shop_prices sp ON sp.product_id = p.id
           JOIN shops s ON s.id = sp.shop_id
           WHERE p.slug = $1
           ORDER BY sp.current_price ASC`,
          [params.slug]
        ),
        client.query(
          `SELECT pi.image_url
           FROM products p
           JOIN product_images pi ON pi.product_id = p.id
           WHERE p.slug = $1
             AND ${productCoverImageFilterSql("pi")}
           ORDER BY ${productCoverImageOrderSql("pi")}`,
          [params.slug]
        ),
        client.query(
          `SELECT source_product_id FROM products WHERE slug = $1 LIMIT 1`,
          [params.slug]
        ),
        client.query(
          `SELECT DATE(ph.recorded_at) AS date, MIN(ph.price) AS prix
           FROM price_history ph
           JOIN products p ON p.id = ph.product_id
           WHERE p.slug = $1 AND ph.recorded_at >= NOW() - INTERVAL '14 days'
           GROUP BY DATE(ph.recorded_at)
           ORDER BY DATE(ph.recorded_at) ASC`,
          [params.slug]
        ),
        client.query(
          `SELECT p.id, p.name, sc.name AS subcategory, lc.name AS low_category, tc.name AS top_category, b.name AS brand
           FROM products p
           LEFT JOIN brands b ON b.id = p.brand_id
           LEFT JOIN product_subcategories psc ON psc.product_id = p.id
           LEFT JOIN subcategories sc ON sc.id = psc.subcategory_id
           LEFT JOIN low_categories lc ON lc.id = sc.low_category_id
           LEFT JOIN top_categories tc ON tc.id = lc.top_category_id
           WHERE p.slug = $1
           LIMIT 1`,
          [params.slug]
        ),
        client.query(
          `SELECT p2.name, p2.slug, COALESCE(b2.name, '') AS brand,
             MIN(sp2.current_price) AS min_price, MAX(sp2.current_price) AS max_price,
             ${productCoverImageSql("p2.id")} AS img
           FROM products p2
           LEFT JOIN brands b2 ON b2.id = p2.brand_id
           LEFT JOIN product_subcategories psc2 ON psc2.product_id = p2.id
           LEFT JOIN subcategories sc2 ON sc2.id = psc2.subcategory_id
           LEFT JOIN low_categories lc2 ON lc2.id = sc2.low_category_id
           LEFT JOIN top_categories tc2 ON tc2.id = lc2.top_category_id
           JOIN shop_prices sp2 ON sp2.product_id = p2.id
           JOIN products p ON p.slug = $1
           LEFT JOIN product_subcategories psc ON psc.product_id = p.id
           LEFT JOIN subcategories sc ON sc.id = psc.subcategory_id
           LEFT JOIN low_categories lc ON lc.id = sc.low_category_id
           LEFT JOIN top_categories tc ON tc.id = lc.top_category_id
           WHERE p2.id <> p.id
             AND (
               sc2.name IS NOT DISTINCT FROM sc.name
               OR lc2.name IS NOT DISTINCT FROM lc.name
               OR tc2.name IS NOT DISTINCT FROM tc.name
             )
           GROUP BY p2.id, p2.name, p2.slug, b2.name
           ORDER BY
             MAX(CASE WHEN sc2.name IS NOT DISTINCT FROM sc.name THEN 1 ELSE 0 END) DESC,
             MAX(CASE WHEN lc2.name IS NOT DISTINCT FROM lc.name THEN 1 ELSE 0 END) DESC,
             MIN(sp2.current_price) ASC
           LIMIT 18`,
          [params.slug]
        ),
        client.query(
          `SELECT ps.spec_key, ps.spec_value
           FROM products p
           JOIN product_specs ps ON ps.product_id = p.id
           WHERE p.slug = $1
             AND ps.spec_key NOT IN ('data_quality_score', 'shop_count')
           ORDER BY ps.id ASC`,
          [params.slug]
        ),
      ]);

      specs = {};
      for (const row of specsRes.rows) {
        if (row.spec_key && row.spec_value) specs[row.spec_key] = row.spec_value;
      }

      for (const row of pricesRes.rows) {
        const price = parseFloat(row.current_price);
        const url = row.shop_product_url;
        for (const key of [row.shop_key, row.shop_name, row.shop_name?.toLowerCase()].filter(Boolean)) {
          shopPrices[key] = price;
          if (url) shopUrls[key] = url;
        }
      }
      images = imagesRes.rows.map(r => r.image_url).filter(Boolean);
      reference = refRes.rows[0]?.source_product_id ?? null;

      const rawHistory = histRes.rows.map((r) => ({
        date: new Date(r.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
        prix: parseFloat(r.prix),
      }));
      priceHistory = resolveDetailPriceHistory(rawHistory, minPrice);

      const headName = headMetaRes.rows[0]?.name ?? product.name;
      const scored = relatedRes.rows
        .map((r) => ({
          name: r.name,
          brand: r.brand,
          img: r.img ?? "",
          minPrice: parseFloat(r.min_price) || 0,
          slug: r.slug,
          discount:
            parseFloat(r.max_price) > parseFloat(r.min_price)
              ? Math.round((1 - parseFloat(r.min_price) / parseFloat(r.max_price)) * 100)
              : null,
          _score: nameSimilarityScore(headName, r.name),
        }))
        .filter((r) => r._score > 0)
        .sort((a, b) => b._score - a._score);

      related = (scored.length >= 3 ? scored : relatedRes.rows.map((r) => ({
        name: r.name,
        brand: r.brand,
        img: r.img ?? "",
        minPrice: parseFloat(r.min_price) || 0,
        slug: r.slug,
        discount:
          parseFloat(r.max_price) > parseFloat(r.min_price)
            ? Math.round((1 - parseFloat(r.min_price) / parseFloat(r.max_price)) * 100)
            : null,
        _score: 0,
      })))
        .slice(0, 6)
        .map(({ _score: _, ...rest }) => rest);
    } finally {
      client.release();
    }

    return NextResponse.json({
      name: product.name,
      brand: product.brand,
      category: "Supermarché",
      img: product.img ?? "",
      images,
      reference,
      minPrice,
      maxPrice,
      shopNames: product.shop_names ?? [],
      discount,
      slug: params.slug,
      shopUrls,
      shopPrices,
      priceHistory,
      related,
      specs,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
