import { NextRequest, NextResponse } from "next/server";
import { catalogPool } from "@/lib/db";
import { resolveCatalogPriceHistory, nameSimilarityScore } from "@/lib/productDetail";


export const revalidate = 300;

function sanitizeImage(raw: string | null | undefined): string {
  if (!raw) return "";
  const matches = String(raw).match(/https?:\/\/\S+\.(?:jpg|jpeg|png|webp|gif|avif)(?:\?[^\s"']*)?/gi);
  if (matches && matches.length) return matches[matches.length - 1];
  return String(raw).trim().split(/\s+/).pop() ?? "";
}

function sanitizeText(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw).replace(/chevron_right/gi, "").replace(/\s+/g, " ").trim();
}

// GET /api/catalog/products/[slug]?shop=tunisianet
// Single product detail: listing + details + price history + related.
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const shop = (req.nextUrl.searchParams.get("shop") ?? "").trim().toLowerCase();
  const slug = params.slug;

  try {
    const pool = catalogPool();

    const prodRes = await pool.query(
      `SELECT p.id, p.name, p.brand, p.image, p.url, p.price, p.old_price, p.available,
              p.availability, p.top_category, p.low_category, p.subcategory,
              s.name AS shop_name, s.slug AS shop_slug, s.id AS shop_id
       FROM products p
       JOIN shops s ON s.id = p.shop_id
       WHERE p.slug = $1 ${shop ? "AND (s.slug = $2 OR s.shop_key = $2)" : ""}
       LIMIT 1`,
      shop ? [slug, shop] : [slug]
    );
    if (!prodRes.rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    const p = prodRes.rows[0];

    const [detRes, histRes, relRes] = await Promise.all([
      pool.query(
        `SELECT title, brand, sku, barcode, overview, description, specifications, images, store_availability
         FROM product_details WHERE product_id = $1`,
        [p.id]
      ),
      pool.query<{ price: string; recorded_at: string }>(
        `SELECT price, recorded_at FROM price_history
         WHERE product_id = $1 AND price IS NOT NULL
         ORDER BY recorded_at ASC LIMIT 365`,
        [p.id]
      ),
      pool.query(
        `SELECT slug, name, image, price, old_price, brand, subcategory, low_category, top_category
         FROM products
         WHERE shop_id = $1 AND id <> $2
           AND (
             (subcategory IS NOT NULL AND subcategory = $3)
             OR (low_category IS NOT NULL AND low_category = $4)
             OR (top_category IS NOT NULL AND top_category = $5)
           )
         ORDER BY
           CASE WHEN subcategory IS NOT DISTINCT FROM $3 THEN 0 ELSE 1 END,
           CASE WHEN low_category IS NOT DISTINCT FROM $4 THEN 0 ELSE 1 END,
           CASE WHEN lower(COALESCE(brand, '')) = lower(COALESCE($6, '')) AND $6 <> '' THEN 0 ELSE 1 END,
           (image IS NOT NULL) DESC,
           name ASC
         LIMIT 24`,
        [p.shop_id, p.id, p.subcategory, p.low_category, p.top_category, p.brand ?? ""]
      ),
    ]);

    const d = detRes.rows[0] ?? {};
    const price = p.price != null ? parseFloat(p.price) : null;
    const old   = p.old_price != null ? parseFloat(p.old_price) : null;

    const rawHistory = histRes.rows.map(h => ({ price: parseFloat(h.price), date: h.recorded_at }));
    const priceHistory = resolveCatalogPriceHistory(rawHistory, price);

    const relatedCandidates = relRes.rows.map(r => ({
      slug: r.slug,
      name: sanitizeText(r.name),
      img: sanitizeImage(r.image),
      price: r.price != null ? parseFloat(r.price) : null,
      _name: sanitizeText(r.name),
    }));

    // Re-rank by name overlap so "iPhone 15" doesn't show random TVs in same category.
    const ranked = [...relatedCandidates]
      .map((r) => ({ ...r, _score: nameSimilarityScore(sanitizeText(p.name), r._name) }))
      .filter((r) => r._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 8);
    const related = (ranked.length >= 4 ? ranked : relatedCandidates.slice(0, 8)).map(({ slug, name, img, price }) => ({
      slug, name, img, price,
    }));

    const cleanImg = sanitizeImage(p.image);
    const cleanImages = Array.isArray(d.images) && d.images.length
      ? d.images.map((x: string) => sanitizeImage(x)).filter(Boolean)
      : (cleanImg ? [cleanImg] : []);

    return NextResponse.json({
      name: sanitizeText(p.name),
      brand: sanitizeText(d.brand ?? p.brand),
      shop: p.shop_name,
      shopSlug: p.shop_slug,
      url: p.url,
      img: cleanImg,
      images: cleanImages,
      price,
      oldPrice: old,
      discount: old && price && old > price ? Math.round((1 - price / old) * 100) : null,
      available: p.available,
      availability: p.availability,
      category: {
        top: sanitizeText(p.top_category),
        low: sanitizeText(p.low_category),
        sub: sanitizeText(p.subcategory),
      },
      sku: d.sku ?? null,
      barcode: d.barcode ?? null,
      overview: d.overview ?? null,
      description: d.description ?? null,
      specifications: d.specifications ?? null,
      storeAvailability: d.store_availability ?? null,
      priceHistory,
      related,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
