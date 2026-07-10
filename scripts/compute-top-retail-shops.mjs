#!/usr/bin/env node
/**
 * Compute Top 5 retail shops from product_clusters.json.
 *
 * Ranking score (competition-weighted fractional wins, in-stock only):
 * - Keep clusters with >= 2 distinct retail shops and valid prices.
 * - Stock filter: latest products_detailed.json per shop (--stock-dir).
 * - Only offers whose URL is in stock in the most recent scrape are counted.
 * - Ex æquo at the lowest price → win split equally.
 * - Score += (win share) × (number of in-stock competitors on that product).
 *
 * Usage:
 *   node scripts/compute-top-retail-shops.mjs <clusters.json> [out.json] [--stock-dir=<scrape_root>]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mapCategory, slugToLabel } from "./retail-category-slug.mjs";

const args = process.argv.slice(2);
const inPath = args.find((a) => a.endsWith(".json") && !a.startsWith("--"));
const outPathArg = args.find((a) => a.endsWith(".json") && a !== inPath);
const stockDirFlag = args.find((a) => a.startsWith("--stock-dir="));

const DEFAULT_STOCK_DIR = "C:/Users/stage.td/Desktop/current_scrapping/data";
const STOCK_DIR = stockDirFlag
  ? stockDirFlag.slice("--stock-dir=".length)
  : existsSync(DEFAULT_STOCK_DIR)
    ? DEFAULT_STOCK_DIR
    : null;

if (!inPath) {
  console.error("Usage: node scripts/compute-top-retail-shops.mjs <clusters.json> [out.json] [--stock-dir=<dir>]");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = outPathArg || join(__dirname, "../lib/data/topRetailShops.json");

const RETAIL_SHOPS = new Set(
  ("spacenet mytek tunisianet gamershop technopro tunewtec carthagoinformatique affariyet wiki jumbo " +
   "bestbuytunisie bill electrohadjkacem zoom alarabia kamounhome sangour yatoo mbm darty infotec jmb " +
   "maalejaudio techgate krichen tokyo_store dokani try_and_buy batam agora bstech qsnet koktahome sbs " +
   "allani emh chaktech informatica itechstore acspace taktek electrochaabani expert_gaming psstore scoop " +
   "graiet techland electrobennjima skymill imag megapc topbureau sigshop ispace benzarti-electromenager")
    .split(/\s+/),
);

const MIN_PRODUCTS = 1000;
const MIN_PRODUCTS_LIST = 50;
const TOP_N = 5;
const COMPETITIVE_MARGIN = 1.05;

function normUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    return u.href.replace(/\/$/, "");
  } catch {
    return String(url || "").trim();
  }
}

/** Same spirit as scripts/migrate-mongo-catalog.mjs */
function isProductInStock(p) {
  if (typeof p.available === "boolean") return p.available;
  const s = String(p.availability || p.stock_status || "").trim();
  if (!s) return true;
  const u = s.toUpperCase();
  if (/IN_?STOCK|EN STOCK|DISPONIBLE|AVAILABLE/.test(u)) return true;
  if (/OUT|RUPTURE|INDISPONIBLE|EPUISE|UNAVAILABLE|NON DISPON/.test(u)) return false;
  return true;
}

/** Parse folder name like 2026-07-03_23-26-47 → epoch ms */
function parseScrapeTimestamp(folderName) {
  const m = /^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})$/.exec(folderName);
  if (!m) return 0;
  const [, date, time] = m;
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi, s] = time.split("-").map(Number);
  return new Date(y, mo - 1, d, h, mi, s).getTime();
}

/**
 * Find the most recent products_detailed.json under a shop folder.
 * Prefers timestamped subfolders (YYYY-MM-DD_HH-MM-SS); falls back to file mtime.
 */
function findLatestDetailed(shopDir) {
  /** @type {{ file: string, ts: number, count: number, folder: string }[]} */
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

/**
 * Load in-stock URLs from the latest scrape of each retail shop.
 * @returns {{ inStock: Set<string>, meta: { shop: string, folder: string, count: number, inStock: number }[] }}
 */
function loadLatestStockIndex(dataDir) {
  /** @type {Set<string>} */
  const inStock = new Set();
  /** @type {{ shop: string, folder: string, count: number, inStock: number }[]} */
  const meta = [];

  if (!dataDir) return { inStock, meta };

  for (const shop of RETAIL_SHOPS) {
    const shopDir = join(dataDir, shop);
    const latest = findLatestDetailed(shopDir);
    if (!latest) continue;

    let arr;
    try {
      arr = JSON.parse(readFileSync(latest.file, "utf-8"));
    } catch {
      continue;
    }
    if (!Array.isArray(arr)) continue;

    let shopInStock = 0;
    for (const p of arr) {
      if (!p?.url || !isProductInStock(p)) continue;
      inStock.add(normUrl(p.url));
      shopInStock++;
    }

    meta.push({
      shop,
      folder: latest.folder,
      count: arr.length,
      inStock: shopInStock,
    });
  }

  meta.sort((a, b) => a.shop.localeCompare(b.shop));
  console.log(
    `  latest scrapes: ${meta.length} shops · ${inStock.size.toLocaleString("fr-FR")} in-stock URLs`,
  );
  return { inStock, meta };
}

const { inStock: inStockUrls, meta: scrapeMeta } = loadLatestStockIndex(STOCK_DIR);

/** @type {Map<string, Set<string>>} */
const shopProducts = new Map();
/** @type {Map<string, number>} */
const fractionalWins = new Map();
/** @type {Map<string, number>} */
const competitionScore = new Map();
/** @type {Map<string, number>} */
const competitiveCount = new Map();
/** @type {Map<string, Map<string, { products: Set<string>, wins: number }>>} */
const shopCatStats = new Map();
/** @type {Map<string, number>} */
const catClusterCount = new Map();

const clusters = JSON.parse(readFileSync(inPath, "utf-8"));
let clustersUsed = 0;
let skippedNotInStock = 0;

for (const c of clusters) {
  const members = (c.members || []).filter((m) => RETAIL_SHOPS.has(m.shop));
  const bestByShop = new Map();

  for (const m of members) {
    const price = typeof m.price === "number" && m.price > 0 ? m.price : null;
    if (price == null) continue;

    if (STOCK_DIR) {
      const url = normUrl(m.url);
      if (!inStockUrls.has(url)) {
        skippedNotInStock++;
        continue;
      }
    }

    const prev = bestByShop.get(m.shop);
    if (!prev || price < prev.price) {
      bestByShop.set(m.shop, { shop: m.shop, price });
    }
  }

  if (bestByShop.size < 2) continue;

  const productId = c.cluster_id || c.reference;
  if (!productId) continue;

  clustersUsed++;

  const catSlug = mapCategory(c.canonical_top_category);
  catClusterCount.set(catSlug, (catClusterCount.get(catSlug) || 0) + 1);

  const offers = [...bestByShop.values()].sort((a, b) => a.price - b.price || a.shop.localeCompare(b.shop));
  const minPrice = offers[0].price;
  const tied = offers.filter((o) => o.price === minPrice);
  const nShops = offers.length;
  const share = 1 / tied.length;
  const points = share * nShops;

  for (const o of offers) {
    if (!shopProducts.has(o.shop)) shopProducts.set(o.shop, new Set());
    shopProducts.get(o.shop).add(productId);
    if (!shopCatStats.has(o.shop)) shopCatStats.set(o.shop, new Map());
    if (!shopCatStats.get(o.shop).has(catSlug)) {
      shopCatStats.get(o.shop).set(catSlug, { products: new Set(), wins: 0 });
    }
    shopCatStats.get(o.shop).get(catSlug).products.add(productId);
    if (o.price <= minPrice * COMPETITIVE_MARGIN) {
      competitiveCount.set(o.shop, (competitiveCount.get(o.shop) || 0) + 1);
    }
  }

  for (const t of tied) {
    fractionalWins.set(t.shop, (fractionalWins.get(t.shop) || 0) + share);
    competitionScore.set(t.shop, (competitionScore.get(t.shop) || 0) + points);
    shopCatStats.get(t.shop).get(catSlug).wins += share;
  }
}

function buildShopRow(shop, rank, top5Keys) {
  const productSet = shopProducts.get(shop);
  const totalProducts = productSet.size;
  const fractional = fractionalWins.get(shop) || 0;
  const comp = competitiveCount.get(shop) || 0;
  let similarProducts = 0;
  if (top5Keys) {
    for (const pid of productSet) {
      for (const other of top5Keys) {
        if (other === shop) continue;
        if (shopProducts.get(other)?.has(pid)) {
          similarProducts++;
          break;
        }
      }
    }
  }
  return {
    rank,
    shop,
    totalProducts,
    cheapestCount: Math.round(fractional),
    competitionScore: Math.round(competitionScore.get(shop) || 0),
    competitiveCount: comp,
    competitivePct: totalProducts > 0 ? Math.round((comp / totalProducts) * 100) : 0,
    similarProducts,
    overlapPct: totalProducts > 0 && top5Keys ? Math.round((similarProducts / totalProducts) * 100) : 0,
    winRatePct: totalProducts > 0 ? Math.round((fractional / totalProducts) * 100) : 0,
  };
}

/** @type {{ shop: string, totalProducts: number, fractionalWins: number }[]} */
const rankedShops = [];

for (const [shop, products] of shopProducts) {
  const totalProducts = products.size;
  if (totalProducts < MIN_PRODUCTS_LIST) continue;
  rankedShops.push({
    shop,
    totalProducts,
    fractionalWins: fractionalWins.get(shop) || 0,
  });
}

rankedShops.sort(
  (a, b) =>
    b.fractionalWins - a.fractionalWins ||
    b.totalProducts - a.totalProducts,
);

const top5Eligible = rankedShops.filter((s) => s.totalProducts >= MIN_PRODUCTS);
const top5Keys = new Set(top5Eligible.slice(0, TOP_N).map((s) => s.shop));

const shops = top5Eligible.slice(0, TOP_N).map((s, i) => buildShopRow(s.shop, i + 1, top5Keys));

const allShops = rankedShops.map((s, i) => buildShopRow(s.shop, i + 1, null));

const categories = [...catClusterCount.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .map(([slug, clusterCount]) => {
    const shopRows = [];
    for (const [shop, catMap] of shopCatStats) {
      const st = catMap.get(slug);
      if (!st || st.products.size === 0) continue;
      const total = st.products.size;
      shopRows.push({
        shop,
        totalProducts: total,
        cheapestCount: Math.round(st.wins),
        winRatePct: Math.round((st.wins / total) * 100),
      });
    }
    shopRows.sort((a, b) => b.cheapestCount - a.cheapestCount);
    return {
      slug,
      label: slugToLabel(slug),
      clusterCount,
      shops: shopRows.slice(0, 8),
      leader: shopRows[0]?.shop ?? null,
    };
  });

const payload = {
  generated_at: new Date().toISOString(),
  source: inPath,
  stock_dir: STOCK_DIR,
  scrapes_used: scrapeMeta.length,
  method:
    "Produits comparables en stock (dernier scrape par enseigne, ≥2 boutiques). Classement par nombre de meilleurs prix (ex æquo partagé). Toutes catégories retail du fichier clusters.",
  clusters_used: clustersUsed,
  min_products: MIN_PRODUCTS,
  min_products_list: MIN_PRODUCTS_LIST,
  in_stock_only: Boolean(STOCK_DIR),
  shops,
  allShops,
  categories,
};

writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf-8");

console.log(`✓ ${clustersUsed} in-stock clusters → ${allShops.length} shops → top ${TOP_N} → ${outPath}`);
if (STOCK_DIR) {
  console.log(`  excluded not in stock: ${skippedNotInStock.toLocaleString("fr-FR")}`);
}
for (const s of shops) {
  console.log(
    `  ${s.rank}. ${s.shop.padEnd(16)} best=${String(s.cheapestCount).padStart(5)} / total=${String(s.totalProducts).padStart(5)} win=${s.winRatePct}%`,
  );
}
