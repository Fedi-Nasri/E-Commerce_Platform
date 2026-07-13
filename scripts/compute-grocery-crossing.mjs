#!/usr/bin/env node
/**
 * Recompute supermarche grocery-crossing ranking from alimentation_db.
 *
 * Method (per product, not pairwise confrontations):
 *   - Product croisé = same canonical product priced in ≥2 shops
 *   - For each crossed product, cheapest shop(s) get 1 win (split on ties)
 *   - Taux = wins ÷ crossed products where the shop participates
 *
 * Usage:
 *   ALIMENTATION_DB_URL=... node scripts/compute-grocery-crossing.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../lib/data/grocery-crossing-ranking.json");

const DB_URL = process.env.ALIMENTATION_DB_URL;
if (!DB_URL) {
  console.error("ALIMENTATION_DB_URL is required");
  process.exit(1);
}

const SHOP_DISPLAY = {
  aziza: "Aziza",
  carrefour: "Carrefour",
  carrefour_market: "Carrefour Market",
  carrefour_express: "Carrefour Express",
  geant: "Geant",
  monoprix: "Monoprix",
  monoprix_glovo: "Monoprix Glovo",
};

const FEATURED_KEYS = new Set([
  "aziza",
  "carrefour",
  "geant",
  "carrefour_market",
  "carrefour_express",
  "monoprix",
]);

const MIN_FEATURED_CROSSED = 2000;

function round(n, d = 2) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function pct(num, den) {
  if (!den) return 0;
  return round((num / den) * 100);
}

const pool = new Pool({ connectionString: DB_URL, max: 4 });
const client = await pool.connect();

try {
  console.log("Loading shop prices from alimentation_db…");

  const { rows: priceRows } = await client.query(`
    SELECT sp.product_id, s.shop_key, sp.current_price::float AS price
    FROM shop_prices sp
    JOIN shops s ON s.id = sp.shop_id
    JOIN products p ON p.id = sp.product_id AND p.status = 'active'
    WHERE sp.current_price IS NOT NULL AND sp.current_price > 0
    ORDER BY sp.product_id
  `);

  const shops = [...new Set(priceRows.map((r) => r.shop_key))].sort();
  const shopName = (k) => SHOP_DISPLAY[k] ?? k;

  // product_id -> [{ shop_key, price }]
  const byProduct = new Map();
  for (const r of priceRows) {
    if (!byProduct.has(r.product_id)) byProduct.set(r.product_id, []);
    byProduct.get(r.product_id).push({ shop_key: r.shop_key, price: r.price });
  }

  const totalProducts = byProduct.size;
  const totalOffers = priceRows.length;

  const shopStats = Object.fromEntries(
    shops.map((k) => [
      k,
      {
        shop_key: k,
        shop_name: shopName(k),
        total_products: 0,
        crossed_products: 0,
        unique_products: 0,
        cheapest_wins: 0,
        price_comparisons: 0,
        matched_with_each_shop: Object.fromEntries(
          shops.filter((s) => s !== k).map((s) => [shopName(s), 0]),
        ),
      },
    ]),
  );

  for (const k of shops) {
    shopStats[k].total_products = priceRows.filter((r) => r.shop_key === k).length;
  }

  const crossingDepth = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  let crossedProducts = 0;

  for (const [, offers] of byProduct) {
    const n = offers.length;
    if (n >= 1 && n <= 7) crossingDepth[String(n)] = (crossingDepth[String(n)] ?? 0) + 1;
    if (n < 2) continue;

    crossedProducts += 1;
    const minPrice = Math.min(...offers.map((o) => o.price));
    const winners = offers.filter((o) => o.price === minPrice);
    const share = 1 / winners.length;

    const shopSet = new Set(offers.map((o) => o.shop_key));
    for (const sk of shopSet) {
      shopStats[sk].crossed_products += 1;
      shopStats[sk].price_comparisons += 1;
    }
    for (const w of winners) {
      shopStats[w.shop_key].cheapest_wins += share;
    }
  }

  // Pairwise overlap counts (products present in both shops)
  const overlap = {};
  for (const a of shops) {
    for (const b of shops) {
      if (a >= b) continue;
      overlap[`${a}|${b}`] = 0;
    }
  }

  for (const [, offers] of byProduct) {
    if (offers.length < 2) continue;
    const keys = [...new Set(offers.map((o) => o.shop_key))].sort();
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const pair = `${keys[i]}|${keys[j]}`;
        if (pair in overlap) overlap[pair] += 1;
        else overlap[`${keys[j]}|${keys[i]}`] = (overlap[`${keys[j]}|${keys[i]}`] ?? 0) + 1;
      }
    }
  }

  const shopHealth = shops.map((k) => {
    const s = shopStats[k];
    s.unique_products = s.total_products - s.crossed_products;
    s.crossing_rate_pct = pct(s.crossed_products, s.total_products);
    s.unique_rate_pct = pct(s.unique_products, s.total_products);
    s.cheapest_rate_pct = pct(s.cheapest_wins, s.crossed_products);
    s.cheapest_wins = round(s.cheapest_wins, 1);

    let best = { shop: "", n: 0 };
    let worst = { shop: "", n: Infinity };
    for (const other of shops) {
      if (other === k) continue;
      const pair = k < other ? `${k}|${other}` : `${other}|${k}`;
      const n = overlap[pair] ?? 0;
      s.matched_with_each_shop[shopName(other)] = n;
      if (n > best.n) best = { shop: shopName(other), n };
      if (n < worst.n) worst = { shop: shopName(other), n };
    }
    s.best_overlap_shop = best.shop;
    s.best_overlap_products = best.n;
    s.weakest_overlap_shop = worst.shop;
    s.weakest_overlap_products = worst.n === Infinity ? 0 : worst.n;
    return s;
  });

  shopHealth.sort((a, b) => b.cheapest_rate_pct - a.cheapest_rate_pct || b.cheapest_wins - a.cheapest_wins);

  const eligibleRanked = shopHealth
    .filter((s) => s.crossed_products >= MIN_FEATURED_CROSSED)
    .sort((a, b) => b.cheapest_rate_pct - a.cheapest_rate_pct || b.cheapest_wins - a.cheapest_wins);
  const limitedRanked = shopHealth
    .filter((s) => s.crossed_products < MIN_FEATURED_CROSSED)
    .sort((a, b) => b.cheapest_rate_pct - a.cheapest_rate_pct || b.cheapest_wins - a.cheapest_wins);
  const shopHealthOrdered = [...eligibleRanked, ...limitedRanked];
  shopHealthOrdered.forEach((s, i) => {
    s.rank = i + 1;
    s.sample_tier = s.crossed_products >= MIN_FEATURED_CROSSED ? "fiable" : "limité";
  });

  const featuredEligible = eligibleRanked.filter((s) => FEATURED_KEYS.has(s.shop_key));
  featuredEligible.sort((a, b) => b.cheapest_rate_pct - a.cheapest_rate_pct || b.cheapest_wins - a.cheapest_wins);
  featuredEligible.forEach((s, i) => {
    s.rank = i + 1;
  });

  function carrefourFamily(keys, label) {
    const nameMap = Object.fromEntries(Object.entries(SHOP_DISPLAY));
    const keySet = new Set(keys);
    let products = 0;
    const wins = Object.fromEntries(keys.map((k) => [nameMap[k], 0]));
    const expensive = Object.fromEntries(keys.map((k) => [nameMap[k], 0]));
    let spreadSum = 0;

    for (const [, offers] of byProduct) {
      const present = offers.filter((o) => keySet.has(o.shop_key));
      if (present.length !== keys.length) continue;
      products += 1;
      const minP = Math.min(...present.map((o) => o.price));
      const maxP = Math.max(...present.map(o => o.price));
      if (maxP > 0) spreadSum += ((maxP - minP) / maxP) * 100;
      const winKeys = present.filter((o) => o.price === minP).map((o) => o.shop_key);
      const maxKeys = present.filter((o) => o.price === maxP).map((o) => o.shop_key);
      const wShare = 1 / winKeys.length;
      const eShare = 1 / maxKeys.length;
      for (const wk of winKeys) wins[nameMap[wk]] += wShare;
      for (const mk of maxKeys) expensive[nameMap[mk]] += eShare;
    }

    return {
      shop_count: keys.length,
      shops: label,
      products,
      price_compared: products,
      cheapest_wins: wins,
      most_expensive_wins: expensive,
      avg_spread_pct: products ? round(spreadSum / products) : 0,
      exact_products: products,
    };
  }

  const carrefour_family = [
    carrefourFamily(
      ["carrefour", "carrefour_market", "carrefour_express"],
      "Carrefour + Carrefour Market + Carrefour Express",
    ),
    carrefourFamily(["carrefour", "carrefour_market"], "Carrefour + Carrefour Market"),
    carrefourFamily(["carrefour", "carrefour_express"], "Carrefour + Carrefour Express"),
    carrefourFamily(["carrefour_market", "carrefour_express"], "Carrefour Market + Carrefour Express"),
  ].filter((c) => c.products > 0);

  const payload = {
    generated_at: new Date().toISOString(),
    method: "per_product_cheapest",
    summary: {
      products: totalProducts,
      offers: totalOffers,
      shops: shops.length,
      crossed_products: crossedProducts,
      not_crossed_products: totalProducts - crossedProducts,
      crossingDepth: Object.fromEntries(
        Object.entries(crossingDepth).map(([k, v]) => [k, v]),
      ),
    },
    featured_shops: featuredEligible.map(({ matched_with_each_shop, sample_tier, ...s }) => s),
    shop_health: shopHealthOrdered.map((s) => ({
      ...s,
    })),
    carrefour_family,
  };

  writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.log(`✓ Written ${OUT}`);
  console.log(`  ${totalProducts} products, ${crossedProducts} crossed, ${totalOffers} offers`);
  console.log("  Top 3 featured:");
  for (const s of featuredEligible.slice(0, 3)) {
    console.log(
      `    ${s.rank}. ${s.shop_name} — ${s.cheapest_rate_pct}% (${Math.round(s.cheapest_wins)}/${s.crossed_products} wins)`,
    );
  }
} finally {
  client.release();
  await pool.end();
}
