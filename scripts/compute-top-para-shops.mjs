#!/usr/bin/env node
/**
 * Compute parapharmacy shop rankings from product_clusters.json.
 *
 * - Keep clusters with >= 2 distinct para shops and valid in-stock prices.
 * - Stock filter: latest products_detailed.json per shop (--stock-dir).
 * - Ex æquo at lowest price → win split equally.
 * - Rank by cheapestCount (meilleurs prix).
 *
 * Usage:
 *   node scripts/compute-top-para-shops.mjs <clusters.json> [out.json] [--stock-dir=<scrape_root>]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
  console.error("Usage: node scripts/compute-top-para-shops.mjs <clusters.json> [out.json] [--stock-dir=<dir>]");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = outPathArg || join(__dirname, "../lib/data/topParaShops.json");

const PARA_SHOPS = new Set(
  (
    "mapara paraexpert parafendri parashop el_farabi parahouse paraland pharmashop " +
    "pharmacieplus tunisiepara lagrandepara beautystore cosmetique"
  ).split(/\s+/),
);

/** Semrush monthly visits (Mai 2026) where available */
const VISITOR_DOMAINS = {
  parashop: "parashop.tn",
  pharmashop: "parapharm.tn",
  beautystore: "beautystore.tn",
  cosmetique: "beautystore.tn",
};

const SEMRUSH_VISITS = {
  "parashop.tn": 66500,
  "parapharm.tn": 39920,
  "beautystore.tn": 0, // filled from topRetailSites if present
};

try {
  const sitesPath = join(__dirname, "../lib/topRetailSites.ts");
  const src = readFileSync(sitesPath, "utf-8");
  for (const m of src.matchAll(/"domain":\s*"([^"]+)"[\s\S]*?"visitsNum":\s*(\d+)/g)) {
    SEMRUSH_VISITS[m[1]] = Number(m[2]);
  }
} catch {}

const MIN_PRODUCTS = 50;

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

function isProductInStock(p) {
  if (typeof p.available === "boolean") return p.available;
  const s = String(p.availability || p.stock_status || "").trim();
  if (!s) return true;
  const u = s.toUpperCase();
  if (/IN_?STOCK|EN STOCK|DISPONIBLE|AVAILABLE/.test(u)) return true;
  if (/OUT|RUPTURE|INDISPONIBLE|EPUISE|UNAVAILABLE|NON DISPON/.test(u)) return false;
  return true;
}

function isPromoProduct(p) {
  const price = Number(p.price ?? p.current_price ?? p.currentPrice);
  const regular = Number(p.regular_price ?? p.regularPrice ?? p.old_price ?? p.oldPrice);
  if (Number.isFinite(price) && Number.isFinite(regular) && regular > price) return true;
  const discount = Number(p.discount ?? p.discount_pct ?? p.discountPct);
  return Number.isFinite(discount) && discount > 0;
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

function loadLatestStockIndex(dataDir) {
  const inStock = new Set();
  const meta = [];
  if (!dataDir) return { inStock, meta };

  for (const shop of PARA_SHOPS) {
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

    meta.push({ shop, folder: latest.folder, count: arr.length, inStock: shopInStock });
  }

  meta.sort((a, b) => a.shop.localeCompare(b.shop));
  console.log(
    `  latest scrapes: ${meta.length} shops · ${inStock.size.toLocaleString("fr-FR")} in-stock URLs`,
  );
  return { inStock, meta };
}

function loadPromoUrls(dataDir) {
  const promos = new Set();
  if (!dataDir) return promos;

  for (const shop of PARA_SHOPS) {
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

    for (const p of arr) {
      if (!p?.url || !isPromoProduct(p)) continue;
      promos.add(normUrl(p.url));
    }
  }
  return promos;
}

const { inStock: inStockUrls, meta: scrapeMeta } = loadLatestStockIndex(STOCK_DIR);
const promoUrls = loadPromoUrls(STOCK_DIR);

const shopProducts = new Map();
const fractionalWins = new Map();
const priceSum = new Map();
const promoCount = new Map();

const clusters = JSON.parse(readFileSync(inPath, "utf-8"));
let clustersUsed = 0;
let skippedNotInStock = 0;

for (const c of clusters) {
  const members = (c.members || []).filter((m) => PARA_SHOPS.has(m.shop));
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
      bestByShop.set(m.shop, { shop: m.shop, price, url: normUrl(m.url) });
    }
  }

  if (bestByShop.size < 2) continue;

  const productId = c.cluster_id || c.reference;
  if (!productId) continue;

  clustersUsed++;

  const offers = [...bestByShop.values()].sort((a, b) => a.price - b.price || a.shop.localeCompare(b.shop));
  const minPrice = offers[0].price;
  const tied = offers.filter((o) => o.price === minPrice);
  const share = 1 / tied.length;

  for (const o of offers) {
    if (!shopProducts.has(o.shop)) shopProducts.set(o.shop, new Set());
    shopProducts.get(o.shop).add(productId);
    priceSum.set(o.shop, (priceSum.get(o.shop) || 0) + o.price);
    if (promoUrls.has(o.url)) {
      promoCount.set(o.shop, (promoCount.get(o.shop) || 0) + 1);
    }
  }

  for (const t of tied) {
    fractionalWins.set(t.shop, (fractionalWins.get(t.shop) || 0) + share);
  }
}

const ranked = [];
for (const [shop, products] of shopProducts) {
  const totalProducts = products.size;
  if (totalProducts < MIN_PRODUCTS) continue;
  const wins = fractionalWins.get(shop) || 0;
  ranked.push({
    shop,
    totalProducts,
    cheapestCount: Math.round(wins),
    cheapestCountExact: Math.round(wins * 10) / 10,
    avgPrice: totalProducts > 0 ? Math.round((priceSum.get(shop) / totalProducts) * 1000) / 1000 : 0,
    promoCount: promoCount.get(shop) || 0,
    winRatePct: totalProducts > 0 ? Math.round((wins / totalProducts) * 100) : 0,
    fractionalWins: wins,
  });
}

ranked.sort((a, b) => b.fractionalWins - a.fractionalWins || b.totalProducts - a.totalProducts);

const maxCheapest = Math.max(...ranked.map((r) => r.cheapestCount), 1);
const maxProducts = Math.max(...ranked.map((r) => r.totalProducts), 1);
const avgPrices = ranked.map((r) => r.avgPrice);
const minAvg = Math.min(...avgPrices);
const maxAvg = Math.max(...avgPrices);

function visitorsFor(shop, products, cheapestCount) {
  const domain = VISITOR_DOMAINS[shop];
  if (domain && SEMRUSH_VISITS[domain]) return SEMRUSH_VISITS[domain];
  return Math.round(products * 35 + cheapestCount * 95);
}

const shops = ranked.map((r, i) => {
  const promoPct = r.totalProducts > 0 ? Math.round((r.promoCount / r.totalProducts) * 100) : 0;
  const availability = clustersUsed > 0 ? Math.round((r.totalProducts / clustersUsed) * 100) : 0;
  const visitors = visitorsFor(r.shop, r.totalProducts, r.cheapestCount);

  const bestPriceScore = (r.cheapestCount / maxCheapest) * 100;
  const priceLevelScore =
    maxAvg === minAvg ? 100 : ((maxAvg - r.avgPrice) / (maxAvg - minAvg)) * 100;
  const catalogScore = (r.totalProducts / maxProducts) * 100;
  const maxVisitors = Math.max(...ranked.map((x) => visitorsFor(x.shop, x.totalProducts, x.cheapestCount)), 1);
  const audienceScore = (visitors / maxVisitors) * 100;
  const score = Math.round(
    bestPriceScore * 0.45 + priceLevelScore * 0.25 + catalogScore * 0.15 + audienceScore * 0.15,
  );

  return {
    rank: i + 1,
    shop: r.shop,
    products: r.totalProducts,
    cheapestCount: r.cheapestCount,
    cheapestCountExact: r.cheapestCountExact,
    avgPrice: r.avgPrice,
    promoCount: r.promoCount,
    promoPct,
    availability,
    winRatePct: r.winRatePct,
    score,
    visitors,
  };
});

const maxVisitors = Math.max(...shops.map((s) => s.visitors), 1);
for (const s of shops) {
  const bestPriceScore = (s.cheapestCount / maxCheapest) * 100;
  const priceLevelScore =
    maxAvg === minAvg ? 100 : ((maxAvg - s.avgPrice) / (maxAvg - minAvg)) * 100;
  const catalogScore = (s.products / maxProducts) * 100;
  const audienceScore = (s.visitors / maxVisitors) * 100;
  s.score = Math.round(
    bestPriceScore * 0.45 + priceLevelScore * 0.25 + catalogScore * 0.15 + audienceScore * 0.15,
  );
}

const payload = {
  generated_at: new Date().toISOString(),
  source: inPath,
  stock_dir: STOCK_DIR,
  scrapes_used: scrapeMeta.length,
  method:
    "Produits parapharmacie comparables en stock (dernier scrape par enseigne, ≥2 boutiques para). Classement par nombre de meilleurs prix (ex æquo partagé).",
  clusters_used: clustersUsed,
  min_products: MIN_PRODUCTS,
  in_stock_only: Boolean(STOCK_DIR),
  shops,
};

writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf-8");

console.log(
  `✓ ${clustersUsed} in-stock para clusters → ${shops.length} shops → ${outPath}`,
);
if (skippedNotInStock) console.log(`  excluded not in stock: ${skippedNotInStock.toLocaleString("fr-FR")}`);
for (const s of shops.slice(0, 8)) {
  console.log(
    `  ${s.rank}. ${s.shop.padEnd(14)} best=${String(s.cheapestCount).padStart(5)} / total=${String(s.products).padStart(5)} win=${s.winRatePct}% avg=${s.avgPrice}`,
  );
}
