#!/usr/bin/env node
/**
 * Import all homepage stats into retail_db PostgreSQL (named tables per stat).
 *
 *   stats_prix_moyen_runs / stats_prix_moyen_shops / stats_prix_moyen_buckets
 *   stats_top_retail_runs / stats_top_retail_shops
 *   stats_para_runs / stats_para_shops
 *   stats_climatiseurs_runs / stats_climatiseurs_shops / stats_climatiseurs_btu
 *
 * Usage:
 *   RETAIL_DB_URL=... node scripts/import-homepage-stats-db.mjs [--stock-dir=/path/to/scrapes]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const stockDirFlag = args.find((a) => a.startsWith("--stock-dir="));
const DEFAULT_STOCK_DIR = "C:/Users/stage.td/Desktop/current_scrapping/data";
const VPS_STOCK_DIR = "/home/ubuntu/scrapping/data";

const STOCK_DIR = stockDirFlag
  ? stockDirFlag.slice("--stock-dir=".length)
  : existsSync(VPS_STOCK_DIR)
    ? VPS_STOCK_DIR
    : existsSync(DEFAULT_STOCK_DIR)
      ? DEFAULT_STOCK_DIR
      : process.env.SHOP_SCRAPE_DIR || process.env.STOCK_DIR || null;

const DB_URL = process.env.RETAIL_DB_URL;
const JSON_OUT = join(__dirname, "../lib/data/retailShopAvgPrices.json");
const TOP_RETAIL_PATH = join(__dirname, "../lib/data/topRetailShops.json");
const TOP_PARA_PATH = join(__dirname, "../lib/data/topParaShops.json");
const CLIM_PATH = join(__dirname, "../lib/data/climatiseursEnStock.json");

const MIN_PRODUCTS = 5;
const FEATURED_MIN = 1000;

const PRICE_BUCKETS = [
  { label: "< 500 DT", min: 0, max: 500 },
  { label: "500 – 2 000 DT", min: 500, max: 2000 },
  { label: "2 000 – 5 000 DT", min: 2000, max: 5000 },
  { label: "5 000 – 15 000 DT", min: 5000, max: 15000 },
  { label: "> 15 000 DT", min: 15000, max: Infinity },
];

const RETAIL_SHOPS = new Set(
  ("spacenet mytek tunisianet gamershop technopro tunewtec carthagoinformatique affariyet wiki jumbo " +
   "bestbuytunisie bill electrohadjkacem zoom alarabia kamounhome sangour yatoo mbm darty infotec jmb " +
   "maalejaudio techgate krichen tokyo_store dokani try_and_buy batam agora bstech qsnet koktahome sbs " +
   "allani emh chaktech informatica itechstore acspace taktek electrochaabani expert_gaming psstore scoop " +
   "graiet techland electrobennjima skymill imag megapc topbureau sigshop ispace benzarti-electromenager")
    .split(/\s+/),
);

function prettyName(key) {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function parsePrice(p) {
  const raw = p?.price ?? p?.current_price ?? p?.sale_price;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 && n < 50000 ? Math.round(n * 100) / 100 : null;
}

function isProductInStock(p) {
  if (typeof p.available === "boolean") return p.available;
  const s = String(p.availability || p.stock_status || "").trim();
  if (!s) return true;
  const u = s.toUpperCase();
  if (/IN_?STOCK|EN STOCK|DISPONIBLE|AVAILABLE/.test(u)) return true;
  if (/OUT|RUPTURE|INDISPONIBLE|EPUISE|UNAVAILABLE|NON DISPON/.test(u)) return false;
  return true;
}

function parseScrapeTimestamp(folderName) {
  const m = /^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})$/.exec(folderName);
  if (!m) return 0;
  const [, date, time] = m;
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi, s] = time.split("-").map(Number);
  return new Date(y, mo - 1, d, h, mi, s).getTime();
}

function findLatestDetailed(shopDir) {
  const candidates = [];
  const addCandidate = (file, folder) => {
    const ts = parseScrapeTimestamp(folder) || statSync(file).mtimeMs;
    let count = 0;
    try {
      const a = JSON.parse(readFileSync(file, "utf-8"));
      count = Array.isArray(a) ? a.length : 0;
    } catch {}
    candidates.push({ file, ts, count, folder });
  };
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        const detailed = join(p, "products_detailed.json");
        if (existsSync(detailed)) addCandidate(detailed, e.name);
        walk(p);
      } else if (e.name === "products_detailed.json") {
        addCandidate(p, dir !== shopDir ? dir.split(/[/\\]/).pop() || "" : "root");
      }
    }
  };
  walk(shopDir);
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.ts - a.ts || b.count - a.count);
  return candidates[0];
}

function volumeTier(n) {
  if (n >= 5000) return "XL";
  if (n >= 2000) return "L";
  if (n >= 500) return "M";
  if (n >= 50) return "S";
  return "XS";
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function computePrixMoyenFromScrapes(dataDir) {
  if (!dataDir) return { shops: [], skipped: [], method: null };
  const shops = [];
  const skipped = [];
  for (const shop of [...RETAIL_SHOPS].sort()) {
    const latest = findLatestDetailed(join(dataDir, shop));
    if (!latest) {
      skipped.push({ shop, reason: "no-scrape" });
      continue;
    }
    let arr;
    try {
      arr = JSON.parse(readFileSync(latest.file, "utf-8"));
    } catch {
      skipped.push({ shop, reason: "parse-error" });
      continue;
    }
    if (!Array.isArray(arr)) continue;
    let priceSum = 0;
    let inStockCount = 0;
    const bucketCounts = PRICE_BUCKETS.map(() => 0);
    for (const p of arr) {
      if (!isProductInStock(p)) continue;
      const price = parsePrice(p);
      if (price == null) continue;
      inStockCount++;
      priceSum += price;
      const idx = PRICE_BUCKETS.findIndex((b) => price >= b.min && price < b.max);
      if (idx >= 0) bucketCounts[idx]++;
    }
    if (inStockCount < MIN_PRODUCTS) {
      skipped.push({ shop, reason: `too-few:${inStockCount}` });
      continue;
    }
    shops.push({
      shop_key: shop,
      display_name: prettyName(shop),
      product_count: inStockCount,
      price_sum: Math.round(priceSum * 100) / 100,
      avg_price: Math.round((priceSum / inStockCount) * 100) / 100,
      volume_tier: volumeTier(inStockCount),
      scrape_folder: latest.folder,
      buckets: PRICE_BUCKETS.map((b, i) => ({
        bucket_label: b.label,
        bucket_order: i + 1,
        product_count: bucketCounts[i],
        share_pct: Math.round((bucketCounts[i] / inStockCount) * 1000) / 10,
      })),
    });
  }
  return {
    shops,
    skipped,
    method:
      "Prix moyen catalogue = somme des prix ÷ nombre de produits en stock par enseigne (catalogue complet, hors rupture).",
  };
}

function enrichPrixMoyenShops(shops) {
  const totalProducts = shops.reduce((a, s) => a + s.product_count, 0);
  const byAvg = [...shops].sort((a, b) => a.avg_price - b.avg_price);
  const byCatalog = [...shops].sort((a, b) => b.product_count - a.product_count);
  return shops.map((s) => {
    const avgPriceRank = byAvg.findIndex((x) => x.shop_key === s.shop_key) + 1;
    const catalogRank = byCatalog.findIndex((x) => x.shop_key === s.shop_key) + 1;
    return {
      ...s,
      avg_price_rank: avgPriceRank,
      catalog_rank: catalogRank,
      accessibility_pct:
        shops.length > 1
          ? Math.round(((shops.length - avgPriceRank) / (shops.length - 1)) * 100)
          : 100,
      catalog_share_pct:
        totalProducts > 0
          ? Math.round((s.product_count / totalProducts) * 1000) / 10
          : 0,
    };
  });
}

async function ensureTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS stats_prix_moyen_runs (
      id SERIAL PRIMARY KEY,
      run_key TEXT UNIQUE NOT NULL DEFAULT 'latest',
      method TEXT NOT NULL,
      in_stock_only BOOLEAN NOT NULL DEFAULT TRUE,
      stock_dir TEXT,
      shop_count INT NOT NULL,
      total_products INT NOT NULL,
      median_avg_price NUMERIC(12,2),
      featured_min_products INT NOT NULL DEFAULT 1000,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS stats_prix_moyen_shops (
      id SERIAL PRIMARY KEY,
      run_id INT NOT NULL REFERENCES stats_prix_moyen_runs(id) ON DELETE CASCADE,
      shop_key TEXT NOT NULL,
      display_name TEXT,
      product_count INT NOT NULL,
      price_sum NUMERIC(14,2) NOT NULL,
      avg_price NUMERIC(12,2) NOT NULL,
      volume_tier TEXT,
      avg_price_rank INT,
      catalog_rank INT,
      accessibility_pct INT,
      catalog_share_pct NUMERIC(8,2),
      scrape_folder TEXT,
      UNIQUE(run_id, shop_key)
    );
    CREATE TABLE IF NOT EXISTS stats_prix_moyen_buckets (
      id SERIAL PRIMARY KEY,
      run_id INT NOT NULL REFERENCES stats_prix_moyen_runs(id) ON DELETE CASCADE,
      shop_key TEXT NOT NULL,
      bucket_label TEXT NOT NULL,
      bucket_order INT NOT NULL,
      product_count INT NOT NULL,
      share_pct NUMERIC(8,2) NOT NULL,
      UNIQUE(run_id, shop_key, bucket_order)
    );
    CREATE TABLE IF NOT EXISTS stats_top_retail_runs (
      id SERIAL PRIMARY KEY,
      run_key TEXT UNIQUE NOT NULL DEFAULT 'latest',
      method TEXT,
      source TEXT,
      stock_dir TEXT,
      clusters_used INT,
      scrapes_used INT,
      min_products INT,
      min_products_list INT,
      in_stock_only BOOLEAN DEFAULT TRUE,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS stats_top_retail_shops (
      id SERIAL PRIMARY KEY,
      run_id INT NOT NULL REFERENCES stats_top_retail_runs(id) ON DELETE CASCADE,
      shop_key TEXT NOT NULL,
      rank INT NOT NULL,
      is_top5 BOOLEAN NOT NULL DEFAULT FALSE,
      total_products_compared INT,
      cheapest_count INT,
      competition_score NUMERIC(12,2),
      competitive_count INT,
      competitive_pct INT,
      similar_products INT,
      overlap_pct INT,
      win_rate_pct INT,
      UNIQUE(run_id, shop_key)
    );
    CREATE TABLE IF NOT EXISTS stats_para_runs (
      id SERIAL PRIMARY KEY,
      run_key TEXT UNIQUE NOT NULL DEFAULT 'latest',
      method TEXT,
      source TEXT,
      stock_dir TEXT,
      clusters_used INT,
      scrapes_used INT,
      min_products INT,
      in_stock_only BOOLEAN DEFAULT TRUE,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS stats_para_shops (
      id SERIAL PRIMARY KEY,
      run_id INT NOT NULL REFERENCES stats_para_runs(id) ON DELETE CASCADE,
      shop_key TEXT NOT NULL,
      rank INT NOT NULL,
      products_compared INT,
      catalog_products INT,
      catalog_total INT,
      cheapest_count NUMERIC(10,1),
      avg_price NUMERIC(12,3),
      promo_count INT,
      promo_pct INT,
      availability_pct INT,
      win_rate_pct INT,
      score INT,
      visitors INT,
      UNIQUE(run_id, shop_key)
    );
    CREATE TABLE IF NOT EXISTS stats_climatiseurs_runs (
      id SERIAL PRIMARY KEY,
      run_key TEXT UNIQUE NOT NULL DEFAULT 'latest',
      mode TEXT,
      method_note TEXT,
      total_climatiseurs INT,
      total_boutiques INT,
      total_marques INT,
      annonces_json JSONB,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE stats_climatiseurs_runs ADD COLUMN IF NOT EXISTS annonces_json JSONB;
    CREATE TABLE IF NOT EXISTS stats_climatiseurs_shops (
      id SERIAL PRIMARY KEY,
      run_id INT NOT NULL REFERENCES stats_climatiseurs_runs(id) ON DELETE CASCADE,
      shop_key TEXT NOT NULL,
      scrape_folder TEXT,
      total_climatiseurs INT,
      marques_json JSONB,
      par_btu_json JSONB,
      moins_cher_json JSONB,
      UNIQUE(run_id, shop_key)
    );
    CREATE TABLE IF NOT EXISTS stats_climatiseurs_btu (
      id SERIAL PRIMARY KEY,
      run_id INT NOT NULL REFERENCES stats_climatiseurs_runs(id) ON DELETE CASCADE,
      btu_tier TEXT NOT NULL,
      shop_key TEXT NOT NULL,
      prix_min NUMERIC(12,2),
      prix_moyen NUMERIC(12,2),
      nb_annonces INT,
      marques_au_prix_min TEXT,
      UNIQUE(run_id, btu_tier, shop_key)
    );
  `);
}

async function importPrixMoyen(client, shops, meta) {
  await client.query(`DELETE FROM stats_prix_moyen_runs WHERE run_key = 'latest'`);
  const run = await client.query(
    `INSERT INTO stats_prix_moyen_runs
       (run_key, method, in_stock_only, stock_dir, shop_count, total_products, median_avg_price, featured_min_products, generated_at)
     VALUES ('latest',$1,TRUE,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      meta.method,
      meta.stock_dir,
      shops.length,
      meta.total_products,
      meta.median_avg_price,
      FEATURED_MIN,
      meta.generated_at,
    ],
  );
  const runId = run.rows[0].id;
  for (const s of shops) {
    await client.query(
      `INSERT INTO stats_prix_moyen_shops
         (run_id, shop_key, display_name, product_count, price_sum, avg_price, volume_tier,
          avg_price_rank, catalog_rank, accessibility_pct, catalog_share_pct, scrape_folder)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        runId, s.shop_key, s.display_name, s.product_count, s.price_sum, s.avg_price, s.volume_tier,
        s.avg_price_rank, s.catalog_rank, s.accessibility_pct, s.catalog_share_pct, s.scrape_folder,
      ],
    );
    for (const b of s.buckets) {
      await client.query(
        `INSERT INTO stats_prix_moyen_buckets (run_id, shop_key, bucket_label, bucket_order, product_count, share_pct)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [runId, s.shop_key, b.bucket_label, b.bucket_order, b.product_count, b.share_pct],
      );
    }
  }
  console.log(`  stats_prix_moyen: ${shops.length} shops`);
  return runId;
}

async function importTopRetail(client, data) {
  await client.query(`DELETE FROM stats_top_retail_runs WHERE run_key = 'latest'`);
  const run = await client.query(
    `INSERT INTO stats_top_retail_runs
       (run_key, method, source, stock_dir, clusters_used, scrapes_used, min_products, min_products_list, in_stock_only, generated_at)
     VALUES ('latest',$1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [
      data.method, data.source, data.stock_dir ?? null, data.clusters_used, data.scrapes_used ?? null,
      data.min_products, data.min_products_list ?? 50, data.in_stock_only ?? true, data.generated_at,
    ],
  );
  const runId = run.rows[0].id;
  const top5 = new Set((data.shops ?? []).map((s) => s.shop));
  const all = data.allShops ?? data.shops ?? [];
  for (const s of all) {
    await client.query(
      `INSERT INTO stats_top_retail_shops
         (run_id, shop_key, rank, is_top5, total_products_compared, cheapest_count, competition_score,
          competitive_count, competitive_pct, similar_products, overlap_pct, win_rate_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        runId, s.shop, s.rank, top5.has(s.shop), s.totalProducts, s.cheapestCount, s.competitionScore,
        s.competitiveCount, s.competitivePct, s.similarProducts, s.overlapPct, s.winRatePct,
      ],
    );
  }
  console.log(`  stats_top_retail: ${all.length} shops`);
}

async function importPara(client, data) {
  await client.query(`DELETE FROM stats_para_runs WHERE run_key = 'latest'`);
  const run = await client.query(
    `INSERT INTO stats_para_runs
       (run_key, method, source, stock_dir, clusters_used, scrapes_used, min_products, in_stock_only, generated_at)
     VALUES ('latest',$1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [
      data.method, data.source, data.stock_dir ?? null, data.clusters_used, data.scrapes_used ?? null,
      data.min_products, data.in_stock_only ?? true, data.generated_at,
    ],
  );
  const runId = run.rows[0].id;
  for (const s of data.shops ?? []) {
    await client.query(
      `INSERT INTO stats_para_shops
         (run_id, shop_key, rank, products_compared, catalog_products, catalog_total, cheapest_count,
          avg_price, promo_count, promo_pct, availability_pct, win_rate_pct, score, visitors)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        runId, s.shop, s.rank, s.products, s.catalogProducts ?? null, s.catalogTotal ?? null,
        s.cheapestCountExact ?? s.cheapestCount, s.avgPrice, s.promoCount, s.promoPct,
        s.availability, s.winRatePct, s.score, s.visitors,
      ],
    );
  }
  console.log(`  stats_para: ${(data.shops ?? []).length} shops`);
}

async function importClimatiseurs(client, data) {
  await client.query(`DELETE FROM stats_climatiseurs_runs WHERE run_key = 'latest'`);
  const run = await client.query(
    `INSERT INTO stats_climatiseurs_runs
       (run_key, mode, method_note, total_climatiseurs, total_boutiques, total_marques, annonces_json, generated_at)
     VALUES ('latest',$1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      data.mode ?? "en_stock",
      data.note_nb_annonces ?? null,
      data.totaux?.climatiseurs ?? 0,
      data.totaux?.boutiques ?? 0,
      data.totaux?.marques ?? 0,
      JSON.stringify(data.annonces ?? []),
      data.generated_at,
    ],
  );
  const runId = run.rows[0].id;
  for (const s of data.par_boutique ?? []) {
    await client.query(
      `INSERT INTO stats_climatiseurs_shops
         (run_id, shop_key, scrape_folder, total_climatiseurs, marques_json, par_btu_json, moins_cher_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        runId, s.shop, s.scrape ?? null, s.total_climatiseurs ?? 0,
        JSON.stringify(s.marques ?? {}),
        JSON.stringify(s.par_btu ?? {}),
        JSON.stringify(s.moins_cher ?? null),
      ],
    );
  }
  for (const [btu, rows] of Object.entries(data.comparaison_globale_par_btu ?? {})) {
    for (const r of rows) {
      await client.query(
        `INSERT INTO stats_climatiseurs_btu
           (run_id, btu_tier, shop_key, prix_min, prix_moyen, nb_annonces, marques_au_prix_min)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          runId, btu, r.shop, r.prix_min, r.prix_moyen, r.nb_annonces,
          (r.marques_au_prix_min ?? []).join(", "),
        ],
      );
    }
  }
  console.log(`  stats_climatiseurs: ${(data.par_boutique ?? []).length} shops`);
}

async function main() {
  if (!DB_URL) {
    console.error("RETAIL_DB_URL is required");
    process.exit(1);
  }

  const generatedAt = new Date().toISOString();
  const { shops: rawShops, skipped, method } = computePrixMoyenFromScrapes(STOCK_DIR);
  if (!rawShops.length) {
    console.error("No prix moyen shops computed — check --stock-dir");
    process.exit(1);
  }
  const prixMoyenShops = enrichPrixMoyenShops(rawShops);
  const totalProducts = prixMoyenShops.reduce((a, s) => a + s.product_count, 0);
  const medianAvg = Math.round(median(prixMoyenShops.map((s) => s.avg_price)) * 100) / 100;

  const jsonPayload = {
    generated_at: generatedAt,
    method,
    in_stock_only: true,
    stock_dir: STOCK_DIR,
    shop_count: prixMoyenShops.length,
    total_products: totalProducts,
    median_avg_price: medianAvg,
    featured_min_products: FEATURED_MIN,
    shops: prixMoyenShops.map(({ buckets, ...s }) => s),
    skipped,
  };
  writeFileSync(JSON_OUT, JSON.stringify(jsonPayload, null, 2), "utf8");
  console.log(`✓ JSON backup → ${JSON_OUT}`);

  const topRetail = JSON.parse(readFileSync(TOP_RETAIL_PATH, "utf8"));
  const topPara = JSON.parse(readFileSync(TOP_PARA_PATH, "utf8"));
  const clim = JSON.parse(readFileSync(CLIM_PATH, "utf8"));

  const pool = new Pool({ connectionString: DB_URL, max: 2 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureTables(client);
    await importPrixMoyen(client, prixMoyenShops, {
      method,
      stock_dir: STOCK_DIR,
      total_products: totalProducts,
      median_avg_price: medianAvg,
      generated_at: generatedAt,
    });
    await importTopRetail(client, topRetail);
    await importPara(client, topPara);
    await importClimatiseurs(client, clim);
    await client.query("COMMIT");
    console.log("✓ All homepage stats imported to PostgreSQL");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
