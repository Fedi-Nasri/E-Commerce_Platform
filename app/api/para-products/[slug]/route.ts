import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import { Pool } from "pg";
import { nameSimilarityScore, resolveDetailPriceHistory } from "@/lib/productDetail";


export const revalidate = 300;

type Product = {
  name: string;
  brand: string;
  category: string;
  img: string;
  minPrice: number;
  maxPrice: number;
  shopNames: string[];
  discount: number | null;
};

let cache: Product[] | null = null;
function loadData(): Product[] {
  if (cache) return cache;
  const file = path.join(process.cwd(), "app/api/para-products/data.json");
  cache = JSON.parse(readFileSync(file, "utf8")) as Product[];
  return cache;
}

function toSlug(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const pool = new Pool({ connectionString: process.env.PARA_DB_URL, max: 3 });

async function getDbData(productName: string, slug: string): Promise<{
  description: string | null;
  reference: string | null;
  images: string[];
  specs: Record<string, string>;
  shopUrls: Record<string, string>;
  shopPrices: Record<string, number>;
  priceHistory: { date: string; prix: number }[];
}> {
  try {
    const client = await pool.connect();
    try {
      const [headRes, specsRes, imagesRes, pricesRes, histRes] = await Promise.all([
        client.query(`SELECT p.description, p.source_product_id FROM products p WHERE p.slug = $1 LIMIT 1`, [slug]),
        client.query(
          `SELECT ps.spec_key, ps.spec_value
           FROM products p
           JOIN product_specs ps ON ps.product_id = p.id
           WHERE p.slug = $1
             AND ps.spec_key NOT IN ('data_quality_score','shop_count')`,
          [slug]
        ),
        client.query(
          `SELECT pi.image_url
           FROM products p
           JOIN product_images pi ON pi.product_id = p.id
           WHERE p.slug = $1
           ORDER BY pi.id ASC`,
          [slug]
        ),
        client.query(
          `SELECT s.shop_key, s.name AS shop_name, sp.shop_product_url, sp.current_price
           FROM products p
           JOIN shop_prices sp ON sp.product_id = p.id
           JOIN shops s ON s.id = sp.shop_id
           WHERE p.slug = $1
           ORDER BY sp.current_price ASC`,
          [slug]
        ),
        client.query(
          `SELECT DATE(ph.recorded_at) AS date, MIN(ph.price) AS prix
           FROM price_history ph
           JOIN products p ON p.id = ph.product_id
           WHERE p.slug = $1 AND ph.recorded_at >= NOW() - INTERVAL '14 days'
           GROUP BY DATE(ph.recorded_at)
           ORDER BY DATE(ph.recorded_at) ASC`,
          [slug]
        ),
      ]);

      const description = headRes.rows[0]?.description ?? null;
      const reference = headRes.rows[0]?.source_product_id ?? null;
      const images = imagesRes.rows.map(r => r.image_url).filter(Boolean);
      const specs: Record<string, string> = {};
      for (const row of specsRes.rows) {
        if (row.spec_key && row.spec_value) specs[row.spec_key] = row.spec_value;
      }
      const shopUrls: Record<string, string> = {};
      const shopPrices: Record<string, number> = {};
      for (const row of pricesRes.rows) {
        const price = parseFloat(row.current_price);
        const url = row.shop_product_url;
        for (const key of [row.shop_key, row.shop_name, row.shop_name?.toLowerCase()].filter(Boolean)) {
          shopPrices[key] = price;
          if (url) shopUrls[key] = url;
        }
      }
      const rawHistory = histRes.rows.map((r) => ({
        date: new Date(r.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
        prix: parseFloat(r.prix),
      }));
      const minFromPrices = Object.values(shopPrices).length ? Math.min(...Object.values(shopPrices)) : null;
      const priceHistory = resolveDetailPriceHistory(rawHistory, minFromPrices);

      return { description, reference, images, specs, shopUrls, shopPrices, priceHistory };
    } finally {
      client.release();
    }
  } catch {
    return { description: null, reference: null, images: [], specs: {}, shopUrls: {}, shopPrices: {}, priceHistory: [] };
  }
}

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const data = loadData();
  const product = data.find(p => toSlug(p.name) === params.slug);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [dbData, relatedRaw] = await Promise.all([
    getDbData(product.name, params.slug),
    Promise.resolve(
      data
        .filter(p => p.category === product.category && p.name !== product.name)
        .map(p => ({ ...p, slug: toSlug(p.name) }))
    ),
  ]);

  const scored = relatedRaw
    .map((p) => ({ ...p, _score: nameSimilarityScore(product.name, p.name) }))
    .filter((p) => p._score > 0)
    .sort((a, b) => b._score - a._score);

  const relatedSource =
    scored.length >= 3 ? scored : relatedRaw.map((p) => ({ ...p, _score: 0 }));

  const related = relatedSource.slice(0, 6).map(({ _score: _, ...rest }) => rest);

  const minPrice = dbData.shopPrices && Object.keys(dbData.shopPrices).length
    ? Math.min(...Object.values(dbData.shopPrices))
    : product.minPrice;

  return NextResponse.json({
    ...product,
    minPrice,
    slug: params.slug,
    description: dbData.description,
    reference: dbData.reference,
    images: dbData.images,
    specs: dbData.specs,
    shopUrls: dbData.shopUrls,
    shopPrices: dbData.shopPrices,
    priceHistory: dbData.priceHistory.length
      ? dbData.priceHistory
      : resolveDetailPriceHistory([], minPrice),
    related,
  });
}
