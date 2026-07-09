import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.RETAIL_DB_URL,
  max: 3,
});

const BRAND_KEYWORDS = [
  "Samsung", "LG", "Sony", "Apple", "iPhone", "Xiaomi", "Huawei",
  "TCL", "Hisense", "Toshiba", "Philips", "Lenovo", "HP", "Dell",
  "Asus", "Acer", "MSI", "Logitech", "Canon", "Epson", "Brother",
  "Bosch", "Whirlpool", "Beko", "Brandt", "Hyundai", "Mont Blanc",
  "Focus", "Condor", "Telefunken", "Saba", "Biolux", "Coala",
  "Midea", "Gree", "Daikin", "JBL", "Marshall", "AQIRYS", "Advance",
];

function pickBrand(name: string): string {
  const lower = name.toLowerCase();
  for (const b of BRAND_KEYWORDS) {
    if (lower.includes(b.toLowerCase())) return b;
  }
  // Fallback: first capitalized token longer than 2 chars
  const m = name.match(/\b[A-Z][A-Za-z0-9]{2,}\b/);
  return m ? m[0] : "Multi-marques";
}

function toFrInt(n: number): string {
  return Math.round(n).toLocaleString("fr-FR").replace(/ /g, " ");
}

function cleanName(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

type OfferRow = {
  id: number;
  name: string;
  slug: string;
  shops: string;
  min_p: string;
  max_p: string;
};

type ShopRow = {
  product_id: number;
  shop: string;
  current_price: string;
  shop_product_url: string | null;
};

type ImageRow = {
  product_id: number;
  image_url: string;
};

export async function GET() {
  try {
    // Pick products: 4 gaming laptops + 4 smartphones, with real images and multi-shop price spread.
    const offersRes = await pool.query<OfferRow & { kind: string }>(`
      WITH stats AS (
        SELECT p.id, p.name, p.slug,
               CASE
                 WHEN lower(p.name) ~ '(iphone|smartphone apple iphone|samsung galaxy s[0-9]|xiaomi redmi note|redmi note|oppo find|realme [0-9])'
                   THEN 'smartphone'
                 WHEN (
                   lower(p.name) LIKE '%pc portable gamer%'
                   OR lower(p.name) LIKE '%laptop gamer%'
                   OR lower(p.name) LIKE '%asus tuf gaming%'
                   OR lower(p.name) LIKE '%asus rog%'
                   OR lower(p.name) LIKE '%lenovo legion%'
                   OR lower(p.name) LIKE '%acer nitro%'
                   OR lower(p.name) LIKE '%acer predator%'
                   OR lower(p.name) LIKE '%msi katana%'
                   OR lower(p.name) LIKE '%msi pulse%'
                   OR lower(p.name) LIKE '%msi cyborg%'
                   OR lower(p.name) LIKE '%gigabyte g5%'
                   OR lower(p.name) LIKE '%hp omen%'
                   OR lower(p.name) LIKE '%hp victus%'
                 )
                   THEN 'gaming'
                 ELSE NULL
               END AS kind,
               COUNT(DISTINCT sp.shop_id)::int AS shops,
               MIN(sp.current_price) AS min_p,
               MAX(sp.current_price) AS max_p
        FROM products p
        JOIN shop_prices sp ON sp.product_id = p.id
        WHERE p.status = 'active'
        GROUP BY p.id, p.name, p.slug
      ),
      ranked AS (
        SELECT *,
               ROW_NUMBER() OVER (PARTITION BY kind ORDER BY shops DESC, (max_p - min_p) DESC) AS rn
        FROM stats
        WHERE kind IS NOT NULL
          AND shops >= 2
          AND (max_p - min_p) > 0
      )
      SELECT id, name, slug, kind, shops::text AS shops, min_p::text AS min_p, max_p::text AS max_p
      FROM ranked
      WHERE rn <= 16
      ORDER BY kind, rn
    `);

    const ids = offersRes.rows.map(r => r.id);
    if (ids.length === 0) return NextResponse.json({ offers: [] });

    const [shopPricesRes, imgsRes] = await Promise.all([
      pool.query<ShopRow>(
        `SELECT sp.product_id, s.name AS shop, sp.current_price::text AS current_price,
                sp.shop_product_url
         FROM shop_prices sp
         JOIN shops s ON s.id = sp.shop_id
         WHERE sp.product_id = ANY($1::bigint[])
         ORDER BY sp.product_id, sp.current_price ASC`,
        [ids]
      ),
      pool.query<ImageRow>(
        `SELECT DISTINCT ON (product_id) product_id, image_url
         FROM product_images
         WHERE product_id = ANY($1::bigint[])
           AND image_url NOT LIKE '%loading%'
           AND image_url NOT LIKE '%placeholder%'
           AND image_url NOT LIKE '%home_default%'
         ORDER BY product_id,
                  CASE
                    WHEN image_url ILIKE '%.webp' THEN 1
                    WHEN image_url ILIKE '%.jpg'  THEN 2
                    WHEN image_url ILIKE '%.jpeg' THEN 2
                    WHEN image_url ILIKE '%.png'  THEN 3
                    ELSE 9
                  END`,
        [ids]
      ),
    ]);

    const imgsByProduct = new Map<number, string>();
    for (const r of imgsRes.rows) imgsByProduct.set(r.product_id, r.image_url);

    const offersByProduct = new Map<number, { shop: string; price: number; url: string | null }[]>();
    for (const r of shopPricesRes.rows) {
      const arr = offersByProduct.get(r.product_id) ?? [];
      arr.push({ shop: r.shop, price: parseFloat(r.current_price), url: r.shop_product_url });
      offersByProduct.set(r.product_id, arr);
    }

    const offers = offersRes.rows.map(r => {
      const min = parseFloat(r.min_p);
      const max = parseFloat(r.max_p);
      const cleanedName = cleanName(r.name);
      return {
        id: r.id,
        name: cleanedName,
        slug: r.slug,
        kind: r.kind,
        brand: pickBrand(cleanedName),
        img: imgsByProduct.get(r.id) ?? "",
        minPrice: toFrInt(min),
        maxPrice: toFrInt(max),
        savings: toFrInt(max - min),
        offers: (offersByProduct.get(r.id) ?? []).map(o => ({
          shop: o.shop,
          price: toFrInt(o.price),
          url: o.url,
        })),
      };
    });

    return NextResponse.json({ offers });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
