#!/usr/bin/env node
/**
 * Compute average catalog price per retail shop:
 *   avg_price = SUM(current_price) / COUNT(products)
 *
 * Usage:
 *   RETAIL_DB_URL=... node scripts/compute-shop-avg-prices.mjs [output.json]
 */
import { writeFileSync } from "node:fs";
import { Pool } from "pg";

const DB_URL = process.env.RETAIL_DB_URL;
if (!DB_URL) {
  console.error("RETAIL_DB_URL is required");
  process.exit(1);
}

const outFile = process.argv[2] ?? "lib/data/retailShopAvgPrices.json";
const pool = new Pool({ connectionString: DB_URL, max: 2 });

function prettyName(key) {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT
        s.shop_key,
        COALESCE(s.name, s.shop_key) AS display_name,
        COUNT(DISTINCT sp.product_id)::int              AS product_count,
        ROUND(SUM(sp.current_price)::numeric, 2)        AS price_sum,
        ROUND(AVG(sp.current_price)::numeric, 2)        AS avg_price
      FROM shops s
      JOIN shop_prices sp ON sp.shop_id = s.id
      JOIN products p ON p.id = sp.product_id
      WHERE p.status = 'active'
        AND sp.current_price IS NOT NULL
        AND sp.current_price > 0
        AND sp.current_price < 50000
      GROUP BY s.id, s.shop_key, s.name
      HAVING COUNT(DISTINCT sp.product_id) >= 5
      ORDER BY avg_price DESC
    `);

    const rows = res.rows.map((r) => ({
      shop_key: r.shop_key,
      display_name: r.display_name ?? prettyName(r.shop_key),
      product_count: Number(r.product_count),
      price_sum: Number(r.price_sum),
      avg_price: Number(r.avg_price),
    }));

    const marketAvg =
      rows.length > 0
        ? Math.round(
            (rows.reduce((a, s) => a + s.avg_price * s.product_count, 0) /
              rows.reduce((a, s) => a + s.product_count, 0)) *
              100,
          ) / 100
        : 0;

    const withIndex = rows.map((s, i) => {
      const vsMarket =
        marketAvg > 0 ? Math.round(((s.avg_price - marketAvg) / marketAvg) * 1000) / 10 : 0;
      return {
        ...s,
        rank: i + 1,
        vs_market_pct: vsMarket,
      };
    });

    const payload = {
      generated_at: new Date().toISOString(),
      method: "sum(prices) / product_count per shop",
      market_avg_price: marketAvg,
      shop_count: withIndex.length,
      total_products: withIndex.reduce((a, s) => a + s.product_count, 0),
      shops: withIndex,
    };

    writeFileSync(outFile, JSON.stringify(payload, null, 2), "utf8");
    console.log(`Written ${outFile} — ${withIndex.length} shops, market avg ${marketAvg} DT`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
