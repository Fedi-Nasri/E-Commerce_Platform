#!/usr/bin/env node
/**
 * Extract live Avène SPF 50+ 50ml sunscreen offers from latest para scrapes.
 * Usage: node scripts/compute-para-sunscreen-offers.mjs [out.json] [--stock-dir=...]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const outPathArg = args.find((a) => a.endsWith(".json") && !a.startsWith("--"));
const stockDirFlag = args.find((a) => a.startsWith("--stock-dir="));

const DEFAULT_STOCK_DIR = "C:/Users/stage.td/Desktop/current_scrapping/data";
const STOCK_DIR = stockDirFlag
  ? stockDirFlag.slice("--stock-dir=".length)
  : existsSync(DEFAULT_STOCK_DIR)
    ? DEFAULT_STOCK_DIR
    : null;

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = outPathArg || join(__dirname, "../lib/data/paraSunscreenOffers.json");

const DISPLAY_NAMES = {
  parafendri: "Parafendri",
  parashop: "ParaShop",
  el_farabi: "El Farabi",
  mapara: "MaPara",
};

/** Primary URLs shown on homepage — refreshed if still in catalogue. */
const PRIMARY = [
  {
    shop: "parafendri",
    url: "https://parafendri.tn/beaute/721-avene-fluide-spf-50-peau-sensible-normales-a-mixtes-50ml-beaute-avene.html",
  },
  {
    shop: "parashop",
    url: "https://www.parashop.tn/solaire/protection-visage/ecran-peaux-seches/avene-creme-spf-50-50ml",
  },
  {
    shop: "el_farabi",
    url: "https://www.paraelfarabi.com/produit/avene-creme-solaire-spf50-fini-invisible-50-ml",
  },
];

const PARA_SHOPS = new Set(Object.keys(DISPLAY_NAMES));

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

function parsePrice(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 5000) return null;
  return Math.round(n * 1000) / 1000;
}

function parseScrapeTimestamp(folderName) {
  const m = /^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})/.exec(folderName);
  if (!m) return 0;
  const [, date, time] = m;
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi, s] = time.split("-").map(Number);
  return new Date(y, mo - 1, d, h, mi, s).getTime();
}

function findLatestDetailed(shopDir) {
  const candidates = [];
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
        if (existsSync(detailed)) {
          const ts = parseScrapeTimestamp(e.name) || statSync(detailed).mtimeMs;
          candidates.push({ file: detailed, ts, folder: e.name });
        }
        walk(p);
      }
    }
  };
  walk(shopDir);
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.ts - a.ts);
  return candidates[0];
}

function normTitle(t) {
  return String(t || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isAveneSpf50_50ml(p) {
  const t = normTitle(p.title);
  if (!/avene/.test(t)) return false;
  if (!/spf\s*50|spf50/.test(t)) return false;
  if (!/50\s*ml|50ml/.test(t)) return false;
  if (!/solaire|solar|ecran|creme|fluide|soin/.test(t)) return false;
  return true;
}

function loadShopCatalog(shop) {
  if (!STOCK_DIR) return [];
  const latest = findLatestDetailed(join(STOCK_DIR, shop));
  if (!latest) return [];
  try {
    const arr = JSON.parse(readFileSync(latest.file, "utf-8"));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function pickOffer(shop, primaryUrl) {
  const catalog = loadShopCatalog(shop);

  function fallback() {
    return catalog
      .filter((p) => isAveneSpf50_50ml(p) && isProductInStock(p))
      .map((p) => ({
        shop,
        displayName: DISPLAY_NAMES[shop] || shop,
        url: p.url,
        title: p.title || null,
        price: parsePrice(p.price),
        regular: parsePrice(p.old_price ?? p.regular_price) ?? null,
        inStock: true,
        source: "matched_fallback",
      }))
      .filter((o) => o.price != null)
      .sort((a, b) => a.price - b.price)[0] ?? null;
  }

  const byUrl = catalog.find((p) => p?.url && normUrl(p.url) === normUrl(primaryUrl));
  if (byUrl) {
    const price = parsePrice(byUrl.price);
    const inStock = isProductInStock(byUrl);
    if (price != null && inStock) {
      return {
        shop,
        displayName: DISPLAY_NAMES[shop] || shop,
        url: byUrl.url,
        title: byUrl.title || null,
        price,
        regular: parsePrice(byUrl.old_price ?? byUrl.regular_price) ?? null,
        inStock: true,
        source: "primary_url",
      };
    }
    if (!inStock) return fallback();
  }

  return fallback();
}

const rawOffers = PRIMARY.map(({ shop, url }) => pickOffer(shop, url)).filter(Boolean);
const inStockOffers = rawOffers.filter((o) => o.inStock);
const sorted = [...inStockOffers].sort((a, b) => a.price - b.price).slice(0, 3);

const offers = sorted.map((o, i) => ({
  rank: i + 1,
  shop: o.shop,
  displayName: o.displayName,
  name: o.displayName,
  url: o.url,
  price: o.price,
  regular: o.regular,
  title: o.title,
  inStock: o.inStock,
}));

const maxPrice = offers.length ? Math.max(...offers.map((o) => o.price)) : 0;
const leader = offers[0] ?? null;
const maxSavings =
  leader && offers.length > 1
    ? Math.round((maxPrice - leader.price) * 1000) / 1000
    : 0;

const payload = {
  generated_at: new Date().toISOString(),
  stock_dir: STOCK_DIR,
  product: {
    label: "AVÈNE Soin Solaire SPF 50+",
    subtitle: "Crème peaux sensibles sèches · 50ml",
    image:
      "https://www.maparatunisie.tn/wp-content/uploads/2021/02/avene-creme-solaire-peaux-sensibles-spf-50-avene-solaires9-1716474405.jpg.webp",
  },
  shopsTracked: rawOffers.length,
  offers,
  maxSavings,
  leaderShop: leader?.displayName ?? null,
};

writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf-8");
console.log(`✓ ${offers.length} in-stock offers → ${outPath}`);
for (const o of offers) {
  console.log(`  ${o.rank}. ${o.displayName} ${o.price} DT${o.regular ? ` (was ${o.regular})` : ""}`);
}
if (maxSavings > 0) console.log(`  savings vs most expensive: ${maxSavings} DT`);
