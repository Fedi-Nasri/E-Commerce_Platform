#!/usr/bin/env node
/** Quick inspect alimentation_db product counts per shop. */
import { Pool } from "pg";

const DB_URL = process.env.ALIMENTATION_DB_URL;
if (!DB_URL) {
  console.error("ALIMENTATION_DB_URL required");
  process.exit(1);
}

const pool = new Pool({ connectionString: DB_URL, max: 2 });
const client = await pool.connect();
try {
  const shops = await client.query(`SELECT id, shop_key, name FROM shops ORDER BY shop_key`);
  console.log("=== SHOPS ===");
  for (const s of shops.rows) console.log(s.shop_key, "->", s.name);

  const perShop = await client.query(`
    SELECT s.shop_key, s.name,
           COUNT(DISTINCT sp.product_id) FILTER (WHERE p.status = 'active') AS products,
           COUNT(DISTINCT sp.product_id) FILTER (
             WHERE p.status = 'active' AND sp.current_price IS NOT NULL AND sp.current_price > 0
           ) AS priced
    FROM shops s
    LEFT JOIN shop_prices sp ON sp.shop_id = s.id
    LEFT JOIN products p ON p.id = sp.product_id
    GROUP BY s.id, s.shop_key, s.name
    ORDER BY priced DESC NULLS LAST
  `);
  console.log("\n=== PRODUCTS PER SHOP ===");
  console.table(perShop.rows);

  const crossed = await client.query(`
    SELECT COUNT(*)::int AS crossed_products FROM (
      SELECT sp.product_id
      FROM shop_prices sp
      JOIN products p ON p.id = sp.product_id AND p.status = 'active'
      WHERE sp.current_price IS NOT NULL AND sp.current_price > 0
      GROUP BY sp.product_id
      HAVING COUNT(DISTINCT sp.shop_id) >= 2
    ) t
  `);
  console.log("\n=== CROSSED PRODUCTS ===", crossed.rows[0]);

  const total = await client.query(`SELECT COUNT(*)::int AS n FROM products WHERE status = 'active'`);
  console.log("=== TOTAL ACTIVE ===", total.rows[0].n);

  const offers = await client.query(`
    SELECT COUNT(*)::int AS n FROM shop_prices sp
    JOIN products p ON p.id = sp.product_id AND p.status = 'active'
    WHERE sp.current_price IS NOT NULL AND sp.current_price > 0
  `);
  console.log("=== PRICED OFFERS ===", offers.rows[0].n);
} finally {
  client.release();
  await pool.end();
}
