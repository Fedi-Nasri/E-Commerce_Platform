import { NextResponse } from "next/server";
import { retailPool } from "@/lib/db";

export const revalidate = 600;

type Item = {
  name: string;
  catalog: "Retail";
  catalogPath: "/retail";
  slug: string;
  shop: string;
  img: string | null;
  currentPrice: number;
  regularPrice: number;
  discountPct: number;
  saving: number;
};

// Only trusted shop image hosts (retail informatique stores).
const RETAIL_IMG_WHITELIST = `
  image_url ~ '^https?://'
  AND (
    image_url ILIKE 'https://www.tunisianet.com.tn/%'
    OR image_url ILIKE 'https://www.mytek.tn/%'
    OR image_url ILIKE 'https://spacenet.tn/%'
    OR image_url ILIKE 'https://agora.tn/%'
    OR image_url ILIKE 'https://www.sbsinformatique.com/%'
  )
`;

// Core informatique only: PCs/laptops, monitors, and office printers.
const INFO_KEYWORDS = `(
  lower(p.name) LIKE '%pc portable%'
  OR lower(p.name) LIKE '%ordinateur portable%'
  OR lower(p.name) LIKE '%portable gamer%'
  OR lower(p.name) LIKE '%pc gamer%'
  OR lower(p.name) LIKE '%laptop%'
  OR lower(p.name) LIKE '%notebook%'
  OR lower(p.name) LIKE '%ultrabook%'
  OR lower(p.name) LIKE '%macbook%'
  OR lower(p.name) LIKE '%thinkpad%'
  OR lower(p.name) LIKE '%ideapad%'
  OR lower(p.name) LIKE '%vivobook%'
  OR lower(p.name) LIKE '%zenbook%'
  OR lower(p.name) LIKE '%lenovo legion%'
  OR lower(p.name) LIKE '%hp victus%'
  OR lower(p.name) LIKE '%hp omen%'
  OR lower(p.name) LIKE '%acer nitro%'
  OR lower(p.name) LIKE '%acer predator%'
  OR lower(p.name) LIKE '%msi katana%'
  OR lower(p.name) LIKE '%asus rog%'
  OR lower(p.name) LIKE '%asus tuf%'
  OR lower(p.name) LIKE '%pc bureau%'
  OR lower(p.name) LIKE '%ordinateur de bureau%'
  OR lower(p.name) LIKE '%desktop%'
  OR lower(p.name) LIKE '%mini pc%'
  OR lower(p.name) LIKE '%all in one%'
  OR lower(p.name) LIKE '%all-in-one%'
  OR lower(p.name) LIKE '%ecran%'
  OR lower(p.name) LIKE '%écran%'
  OR lower(p.name) LIKE '%cran pc%'
  OR lower(p.name) LIKE '%moniteur%'
  OR lower(p.name) LIKE '%monitor%'
  OR lower(p.name) LIKE '%imprimante%'
  OR lower(p.name) LIKE '%printer%'
)`;

const EXCLUDED_INFO_KEYWORDS = `(
  lower(p.name) LIKE '%onduleur%'
  OR lower(p.name) LIKE '%ups%'
  OR lower(p.name) LIKE '%routeur%'
  OR lower(p.name) LIKE '%router%'
  OR lower(p.name) LIKE '%switch%'
  OR lower(p.name) LIKE '%clavier%'
  OR lower(p.name) LIKE '%souris%'
  OR lower(p.name) LIKE '%casque%'
  OR lower(p.name) LIKE '%ecouteur%'
  OR lower(p.name) LIKE '%écouteur%'
  OR lower(p.name) LIKE '%webcam%'
  OR lower(p.name) LIKE '%microphone%'
  OR lower(p.name) LIKE '%tablette%'
  OR lower(p.name) LIKE '%smartphone%'
  OR lower(p.name) LIKE '%power bank%'
  OR lower(p.name) LIKE '%chargeur%'
  OR lower(p.name) LIKE '%cable%'
  OR lower(p.name) LIKE '%adaptateur%'
  OR lower(p.name) LIKE '%toner%'
  OR lower(p.name) LIKE '%cartouche%'
  OR lower(p.name) LIKE '%ruban%'
  OR lower(p.name) LIKE '%thermique%'
  OR lower(p.name) LIKE '%ticket%'
  OR lower(p.name) LIKE '%tiquette%'
  OR lower(p.name) LIKE '%étiquette%'
  OR lower(p.name) LIKE '%industriel%'
  OR lower(p.name) LIKE '%barcode%'
  OR lower(p.name) LIKE '%code barre%'
  OR lower(p.name) LIKE '% pos %'
)`;

export async function GET() {
  try {
    const pool = retailPool();
    const r = await pool.query<{
      name: string; slug: string; shop: string; img: string | null;
      current_price: string; regular_price: string;
    }>(
      `WITH per_product AS (
         SELECT
           product_id,
           MIN(current_price) AS market_min,
           MAX(current_price) AS market_max,
           COUNT(DISTINCT shop_id) AS shop_count
         FROM shop_prices
         WHERE current_price > 0
         GROUP BY product_id
       ),
       ranked AS (
         SELECT DISTINCT ON (p.id)
                p.id,
                p.name,
                p.slug,
                s.name AS shop,
                sp.current_price,
                sp.regular_price,
                pp.market_min,
                pp.market_max,
                pp.shop_count,
                (
                  SELECT image_url FROM product_images
                  WHERE product_id = p.id AND ${RETAIL_IMG_WHITELIST}
                  ORDER BY id ASC LIMIT 1
                ) AS img
         FROM shop_prices sp
         JOIN products p ON p.id = sp.product_id
         JOIN shops s ON s.id = sp.shop_id
         JOIN per_product pp ON pp.product_id = sp.product_id
         WHERE p.status = 'active'
           AND sp.current_price > 0
           AND sp.regular_price > 0
           AND sp.current_price < sp.regular_price
           AND (sp.regular_price - sp.current_price) / sp.regular_price BETWEEN 0.08 AND 0.45
           AND sp.current_price >= 250
           AND pp.shop_count >= 2
           AND sp.current_price <= pp.market_min * 1.05
           AND sp.current_price <= pp.market_max * 0.97
           AND ${INFO_KEYWORDS}
           AND NOT ${EXCLUDED_INFO_KEYWORDS}
           AND NOT (
             pp.shop_count >= 3
             AND sp.regular_price > pp.market_min * 1.50
             AND sp.current_price <= pp.market_min * 1.15
           )
           AND EXISTS (
             SELECT 1 FROM product_images
             WHERE product_id = p.id AND ${RETAIL_IMG_WHITELIST}
           )
         ORDER BY p.id, (sp.regular_price - sp.current_price) DESC, sp.updated_at DESC
       )
       SELECT name,
              slug,
              shop,
              img,
              current_price::text,
              regular_price::text
       FROM ranked
       ORDER BY (regular_price - current_price) DESC, shop_count DESC, (market_max - market_min) DESC
       LIMIT 5`
    );

    const items: Item[] = r.rows.map((row) => {
      const current = parseFloat(row.current_price);
      const regular = parseFloat(row.regular_price);
      const saving = regular - current;
      const pct = regular > 0 ? Math.round((saving / regular) * 100) : 0;
      return {
        name: row.name,
        catalog: "Retail",
        catalogPath: "/retail",
        slug: row.slug,
        shop: row.shop,
        img: row.img,
        currentPrice: current,
        regularPrice: regular,
        discountPct: pct,
        saving,
      };
    });

    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ items: [], error: String(err) }, { status: 200 });
  }
}
