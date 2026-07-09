#!/usr/bin/env node
/**
 * Import new matched retail clusters into retail_db (runs ON the VPS).
 *
 * Reads the transformed JSONL (from transform-clusters-to-retail.mjs):
 *   { name, reference, brand, category, category_slug, offers:[{shop,price,old_price,source_url,sku}] }
 *
 * Safety / reversibility:
 *  - Every product it creates is tagged source_product_id = the cluster_* id.
 *    → full rollback = DELETE FROM products WHERE source_product_id LIKE 'cluster_%'
 *      (cascades to shop_prices, product_images, product_subcategories).
 *  - It NEVER touches the existing catalog_* matched products or unmatched catalog.
 *  - Idempotent: re-running upserts by source_product_id instead of duplicating.
 *
 * Images: sourced by matching each offer's source_url to an existing catalog
 * product that already has images (≈93% coverage), copied into the new product.
 *
 * Usage (on VPS):
 *   node import-retail-clusters.mjs /tmp/retail_matched.jsonl [--dry-run]
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import pg from "pg";

const { Pool } = pg;
const FILE = process.argv.find((a) => a.endsWith(".jsonl"));
const DRY = process.argv.includes("--dry-run");
if (!FILE) { console.error("Usage: node import-retail-clusters.mjs <file.jsonl> [--dry-run]"); process.exit(1); }

const pool = new Pool({
  host: "localhost", port: Number(process.env.RETAIL_PORT || 5433),
  user: "retail_user", password: "galylio-ai", database: "retail_db",
  max: 4,
});

function slugify(s) {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180) || "produit";
}

async function main() {
  const client = await pool.connect();
  try {
    // ── caches ──
    const topBySlug = new Map();
    for (const r of (await client.query("SELECT id, slug FROM top_categories")).rows) topBySlug.set(r.slug, r.id);

    const shopByKey = new Map();
    for (const r of (await client.query("SELECT id, shop_key FROM shops")).rows) shopByKey.set(r.shop_key, r.id);

    const brandBySlug = new Map();
    for (const r of (await client.query("SELECT id, slug FROM brands")).rows) brandBySlug.set(r.slug, r.id);

    const slugsSeen = new Set();
    for (const r of (await client.query("SELECT slug FROM products")).rows) slugsSeen.add(r.slug);

    const existingCluster = new Set();
    for (const r of (await client.query("SELECT source_product_id FROM products WHERE source_product_id LIKE 'cluster_%'")).rows)
      existingCluster.add(r.source_product_id);

    // For each top slug, ensure a matching low+sub exists (the DB pattern: one
    // low + one sub per top, sharing the slug). Build slug → subcategory_id.
    const subByTopSlug = new Map();
    async function subForTop(topSlug) {
      if (subByTopSlug.has(topSlug)) return subByTopSlug.get(topSlug);
      const topId = topBySlug.get(topSlug);
      if (!topId) return null;
      const low = await client.query(
        `INSERT INTO low_categories (top_category_id, name, slug, status) VALUES ($1,$2,$3,'active')
         ON CONFLICT (top_category_id, slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
        [topId, topSlug, topSlug]);
      const lowId = low.rows[0].id;
      const sub = await client.query(
        `INSERT INTO subcategories (low_category_id, name, slug, status) VALUES ($1,$2,$3,'active')
         ON CONFLICT (low_category_id, slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
        [lowId, topSlug, topSlug]);
      subByTopSlug.set(topSlug, sub.rows[0].id);
      return sub.rows[0].id;
    }

    // Ensure "non-categorise" top exists
    if (!topBySlug.has("non-categorise")) {
      const r = await client.query(
        `INSERT INTO top_categories (name, slug, status) VALUES ('Non catégorisé','non-categorise','active')
         ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`);
      topBySlug.set("non-categorise", r.rows[0].id);
    }

    let created = 0, updated = 0, skippedBad = 0, withImg = 0, batch = 0;
    const rl = createInterface({ input: createReadStream(FILE, { encoding: "utf8" }), crlfDelay: Infinity });

    for await (const line of rl) {
      const t = line.trim();
      if (!t) continue;
      let p;
      try { p = JSON.parse(t); } catch { skippedBad++; continue; }
      if (!p.name || !p.reference || !p.offers?.length) { skippedBad++; continue; }

      const validOffers = p.offers.filter((o) => shopByKey.has(o.shop));
      if (new Set(validOffers.map((o) => o.shop)).size < 2) { skippedBad++; continue; }

      if (DRY) { created++; continue; }

      await client.query("BEGIN");
      try {
        // brand
        let brandId = null;
        if (p.brand) {
          const bslug = slugify(p.brand);
          if (brandBySlug.has(bslug)) brandId = brandBySlug.get(bslug);
          else {
            const br = await client.query(
              `INSERT INTO brands (name, slug, status) VALUES ($1,$2,'active')
               ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [p.brand, bslug]);
            brandId = br.rows[0].id; brandBySlug.set(bslug, brandId);
          }
        }

        // product (upsert by source_product_id)
        let productId;
        if (existingCluster.has(p.reference)) {
          const r = await client.query(
            `UPDATE products SET name=$2, brand_id=$3, is_matched=TRUE, updated_at=now()
             WHERE source_product_id=$1 RETURNING id`, [p.reference, p.name, brandId]);
          productId = r.rows[0].id; updated++;
        } else {
          let base = slugify(p.name), s = base, i = 2;
          while (slugsSeen.has(s)) s = `${base}-${i++}`;
          slugsSeen.add(s);
          const r = await client.query(
            `INSERT INTO products (source_product_id, name, slug, brand_id, is_matched, status)
             VALUES ($1,$2,$3,$4,TRUE,'active') RETURNING id`, [p.reference, p.name, s, brandId]);
          productId = r.rows[0].id; created++;
        }

        // category link
        const subId = await subForTop(topBySlug.has(p.category_slug) ? p.category_slug : "non-categorise");
        if (subId) {
          await client.query(
            `INSERT INTO product_subcategories (product_id, subcategory_id) VALUES ($1,$2)
             ON CONFLICT DO NOTHING`, [productId, subId]);
        }

        // offers → shop_prices
        for (const o of validOffers) {
          await client.query(
            `INSERT INTO shop_prices (product_id, shop_id, current_price, regular_price, shop_product_url)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (product_id, shop_id) DO UPDATE
             SET current_price=EXCLUDED.current_price, shop_product_url=EXCLUDED.shop_product_url, updated_at=now()`,
            [productId, shopByKey.get(o.shop), o.price, o.old_price, o.source_url || ""]);
        }

        // images: copy from an existing catalog product sharing any offer URL
        const urls = validOffers.map((o) => o.source_url).filter(Boolean);
        if (urls.length) {
          const imgRes = await client.query(
            `SELECT DISTINCT pi.image_url
             FROM shop_prices sp
             JOIN product_images pi ON pi.product_id = sp.product_id
             WHERE sp.shop_product_url = ANY($1::text[])
             LIMIT 8`, [urls]);
          if (imgRes.rows.length) {
            withImg++;
            for (const ir of imgRes.rows) {
              await client.query(
                `INSERT INTO product_images (product_id, image_url) VALUES ($1,$2)
                 ON CONFLICT (product_id, image_url) DO NOTHING`, [productId, ir.image_url]);
            }
          }
        }

        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        skippedBad++;
        if (skippedBad <= 5) console.error("row failed:", p.reference, e.message);
      }

      if (++batch % 1000 === 0) process.stdout.write(`\r  processed ${batch}... (created ${created}, img ${withImg})`);
    }
    process.stdout.write("\n");
    console.log(DRY
      ? `DRY RUN: would import ${created} clusters (skipped ${skippedBad})`
      : `✓ created ${created}, updated ${updated}, with-image ${withImg}, skipped ${skippedBad}`);
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
