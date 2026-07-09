import { NextResponse } from "next/server";
import { Pool } from "pg";


export const revalidate = 300;

const pool = new Pool({
  connectionString: process.env.ALIMENTATION_DB_URL,
  max: 5,
});

// Staple categories — each matched by a name keyword on the product.
// For each (shop, staple) we take the cheapest matching item in that shop,
// then sum across staples to compare baskets fairly.
const BASKET_STAPLES: { label: string; pattern: string }[] = [
  { label: "Tomate",  pattern: "%tomate%" },
  { label: "Huile",   pattern: "%huile%" },
  { label: "Lait",    pattern: "%lait%" },
  { label: "Thon",    pattern: "%thon%" },
  { label: "Sucre",   pattern: "%sucre%" },
  { label: "Fromage", pattern: "%fromage%" },
  { label: "Boeuf",   pattern: "%boeuf%" },
  { label: "Jambon",  pattern: "%jambon%" },
  { label: "Poulet",  pattern: "%poulet%" },
  { label: "Olives",  pattern: "%olive%" },
  { label: "Harissa", pattern: "%harissa%" },
  { label: "Café",    pattern: "%caf%" },
];
const BASKET_SIZE = BASKET_STAPLES.length;
// Shops only need to cover this fraction of the basket to be ranked.
// 50% lets smaller shops (Carrefour Market/Express, Monoprix Glovo) still
// appear so the table consistently shows 5+ enseignes.
const BASKET_COVERAGE = 0.5;
const VEILLE_SIZE = 4;

function formatMillimes(n: number): string {
  return n.toFixed(3);
}

function formatPrice(n: number): string {
  const rounded = Math.round(n);
  return rounded.toLocaleString("fr-FR").replace(/ |,/g, " ");
}

export async function GET() {
  try {
    // 1+2. Build a 5-staple basket (tomate, huile, lait, thon, sucre).
    //      For each (shop, staple), take the cheapest matching product in that
    //      shop. Sum the 5 cheapest per shop. Keep only shops covering all 5.
    const labels = BASKET_STAPLES.map((s) => s.label);
    const patterns = BASKET_STAPLES.map((s) => s.pattern);

    // Min number of staples a shop must carry to be included in the table.
    const minCovered = Math.max(1, Math.ceil(BASKET_SIZE * BASKET_COVERAGE));

    const basketRes = await pool.query<{ shop: string; total: string; covered: string }>(
      `WITH staples (label, pattern) AS (
         SELECT * FROM UNNEST($1::text[], $2::text[]) AS t(label, pattern)
       ),
       per_shop_staple AS (
         SELECT sp.shop_id,
                st.label,
                MIN(sp.current_price) AS price
         FROM shop_prices sp
         JOIN products p ON p.id = sp.product_id
         JOIN staples st ON lower(p.name) LIKE st.pattern
         WHERE sp.current_price > 0
         GROUP BY sp.shop_id, st.label
       ),
       per_shop AS (
         SELECT shop_id,
                -- normalise: extrapolate full basket from covered items so
                -- a shop missing 1-2 staples isn't unfairly cheaper.
                (SUM(price) / COUNT(*) * $4)::numeric AS total,
                COUNT(*) AS covered
         FROM per_shop_staple
         GROUP BY shop_id
         HAVING COUNT(*) >= $3
       )
       SELECT s.name AS shop,
              ps.total::text AS total,
              ps.covered::text AS covered
       FROM per_shop ps
       JOIN shops s ON s.id = ps.shop_id
       ORDER BY ps.total ASC
       LIMIT 6`,
      [labels, patterns, minCovered, BASKET_SIZE]
    );

    const enseignes: Array<{ name: string; total: number }> = basketRes.rows.map((r) => ({
      name: r.shop,
      total: parseFloat(r.total) || 0,
    }));

    const cheapest = enseignes[0]?.total ?? 0;
    const mostExpensive = enseignes.length ? enseignes[enseignes.length - 1].total : 0;
    const economy = mostExpensive - cheapest;

    const enseigneList = enseignes.map((e, i) => ({
      name: e.name,
      price: formatPrice(e.total),
      diff: i === 0 ? "Meilleur prix" : `+${formatPrice(e.total - cheapest)} DT`,
      best: i === 0,
    }));

    // 3. Top économies: products with the biggest absolute saving (max-min) between shops,
    //    sold in 3+ shops. Returns image, cheapest shop name, and DT savings — so the card
    //    tells a complete story: "switch shops for this product, save X DT".
    const veilleRes = await pool.query<{
      name: string;
      min_price: string;
      max_price: string;
      cheapest_shop: string;
      img: string | null;
      slug: string;
    }>(
      `WITH ranked AS (
         SELECT p.id,
                p.name,
                p.slug,
                MIN(sp.current_price) AS min_price,
                MAX(sp.current_price) AS max_price,
                COUNT(DISTINCT sp.shop_id) AS shop_count
         FROM products p
         JOIN shop_prices sp ON sp.product_id = p.id
         WHERE sp.current_price > 0
         GROUP BY p.id, p.name, p.slug
         HAVING COUNT(DISTINCT sp.shop_id) >= 3
            AND MAX(sp.current_price) > 0
            AND (MAX(sp.current_price) - MIN(sp.current_price)) / MAX(sp.current_price) >= 0.10
       )
       SELECT r.name,
              r.slug,
              r.min_price::text,
              r.max_price::text,
              (
                SELECT s.name FROM shop_prices sp2
                JOIN shops s ON s.id = sp2.shop_id
                WHERE sp2.product_id = r.id AND sp2.current_price = r.min_price
                ORDER BY s.id ASC LIMIT 1
              ) AS cheapest_shop,
              (
                SELECT image_url FROM product_images
                WHERE product_id = r.id AND image_url LIKE 'https://%'
                ORDER BY id ASC LIMIT 1
              ) AS img
       FROM ranked r
       ORDER BY (r.max_price - r.min_price) DESC
       LIMIT $1`,
      [VEILLE_SIZE]
    );

    const veille = veilleRes.rows.map((r) => {
      const min = parseFloat(r.min_price) || 0;
      const max = parseFloat(r.max_price) || min;
      const saving = max - min;
      const pct = max > 0 ? ((max - min) / max) * 100 : 0;
      return {
        name: r.name,
        slug: r.slug,
        minPrice: formatMillimes(min),
        maxPrice: formatMillimes(max),
        saving: formatMillimes(saving),
        savingPct: `${pct.toFixed(0)}%`,
        cheapestShop: r.cheapest_shop || "—",
        img: r.img,
      };
    });

    // 4. Pot crème 100% emmental fondu — featured product for the price-alert card.
    //    Look up by slug first (post-import), with a name LIKE fallback for safety.
    const TARGET_SLUG = "pot-creme-100-emmental-fondu";

    let candidates = await pool.query<{ id: number; name: string }>(
      `SELECT id, name FROM products WHERE slug = $1 LIMIT 1`,
      [TARGET_SLUG]
    );
    if (candidates.rows.length === 0) {
      candidates = await pool.query<{ id: number; name: string }>(
        `SELECT id, name FROM products
         WHERE lower(name) LIKE '%emmental%fondu%'
            OR lower(name) LIKE '%pot%cr_me%emmental%'
         LIMIT 1`
      );
    }
    const target = candidates.rows[0] ?? null;

    let milkRes: { rows: Array<{ name: string; brand: string; shop: string; min_price: string; max_price: string; avg_price: string; img: string | null }> } = { rows: [] };
    if (target) {
      milkRes = await pool.query(
        `SELECT p.name,
                COALESCE(b.name, '') AS brand,
                s.name AS shop,
                sp.current_price AS min_price,
                (SELECT MAX(sp2.current_price) FROM shop_prices sp2 WHERE sp2.product_id = p.id) AS max_price,
                (SELECT AVG(sp2.current_price) FROM shop_prices sp2 WHERE sp2.product_id = p.id) AS avg_price,
                (SELECT image_url FROM product_images WHERE product_id = p.id LIMIT 1) AS img
         FROM products p
         LEFT JOIN brands b ON b.id = p.brand_id
         JOIN shop_prices sp ON sp.product_id = p.id
         JOIN shops s ON s.id = sp.shop_id
         WHERE p.id = $1
         ORDER BY sp.current_price ASC
         LIMIT 1`,
        [target.id]
      );
    }

    let alert: {
      name: string;
      brand: string;
      shop: string;
      price: string;
      oldPrice: string;
      change: string;
      down: boolean;
      saved: string;
      min: string;
      max: string;
      slug: string;
      href: string;
      img: string | null;
    } | null = null;

    if (milkRes.rows.length > 0) {
      const r = milkRes.rows[0];
      const min = parseFloat(r.min_price) || 0;
      const max = parseFloat(r.max_price) || min;
      const avg = parseFloat(r.avg_price) || min;
      const pct = avg > 0 ? ((min - avg) / avg) * 100 : 0;
      const saved = avg - min;
      alert = {
        name: r.name,
        brand: r.brand,
        shop: r.shop,
        price: formatMillimes(min),
        oldPrice: formatMillimes(avg),
        change: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`,
        down: pct <= 0,
        saved: formatMillimes(Math.max(saved, 0)),
        min: formatMillimes(min),
        max: formatMillimes(max),
        slug: TARGET_SLUG,
        href: `/supermarche/${TARGET_SLUG}`,
        img: r.img ?? null,
      };
    }

    return NextResponse.json({
      enseignes: enseigneList,
      basketSize: BASKET_SIZE,
      economy: formatPrice(economy),
      veille,
      alert,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
