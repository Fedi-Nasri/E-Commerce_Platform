import { NextResponse } from "next/server";
import { Pool } from "pg";
import { readFileSync } from "fs";
import path from "path";
import { localShopLogo } from "@/lib/shopLogos";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const retailPool = new Pool({
  connectionString: process.env.RETAIL_DB_URL,
  max: 2,
});

// ── Shared helpers ──────────────────────────────────────────────

function prettyName(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Retail shops (from DB) ──────────────────────────────────────

type RetailShop = {
  shop: string;
  displayName: string;
  logo: string | null;
  totalProducts: number;
  cheapestCount: number;
  similarProducts: number;
  avgPrice: number;
  rank: number;
};

async function getRetailShops(): Promise<RetailShop[]> {
  const client = await retailPool.connect();
  try {
    const res = await client.query(`
      WITH shop_stats AS (
        SELECT
          s.shop_key,
          s.name                                          AS display_name,
          COUNT(DISTINCT sp.product_id)                   AS total_products,
          AVG(sp.current_price)                           AS avg_price,
          COUNT(DISTINCT CASE
            WHEN sp.current_price = (
              SELECT MIN(sp2.current_price)
              FROM shop_prices sp2
              WHERE sp2.product_id = sp.product_id
                AND sp2.current_price IS NOT NULL
            ) THEN sp.product_id
          END)                                            AS cheapest_count
        FROM shops s
        JOIN shop_prices sp ON sp.shop_id = s.id
        JOIN products p ON p.id = sp.product_id
        WHERE p.is_matched = true
          AND p.status = 'active'
          AND sp.current_price IS NOT NULL
        GROUP BY s.id, s.shop_key, s.name
        HAVING COUNT(DISTINCT sp.product_id) >= 10
        ORDER BY cheapest_count DESC
      )
      SELECT
        ss.shop_key,
        ss.display_name,
        ss.total_products,
        ss.cheapest_count,
        ss.avg_price,
        (
          SELECT COUNT(DISTINCT sp3.product_id)
          FROM shop_prices sp3
          JOIN shops s3 ON s3.id = sp3.shop_id
          WHERE sp3.product_id IN (
            SELECT sp4.product_id FROM shop_prices sp4
            JOIN shops s4 ON s4.id = sp4.shop_id
            WHERE s4.shop_key = ss.shop_key
          )
          AND s3.shop_key != ss.shop_key
        )                                                 AS similar_products
      FROM shop_stats ss
      ORDER BY ss.cheapest_count DESC
    `);

    return res.rows.map((r, i) => ({
      shop: r.shop_key,
      displayName: r.display_name ?? prettyName(r.shop_key),
      logo: localShopLogo(r.shop_key) ?? `/shop-logos/${r.shop_key}.png`,
      totalProducts: Number(r.total_products),
      cheapestCount: Number(r.cheapest_count),
      similarProducts: Number(r.similar_products),
      avgPrice: Number(r.avg_price) || 0,
      rank: i + 1,
    }));
  } finally {
    client.release();
  }
}

// ── Parapharmacie shops (from static JSON, same as para-shops-stats) ──

type ParaShop = {
  shop: string;
  displayName: string;
  logo: string | null;
  totalProducts: number;
  cheapestCount: number;
  promoCount: number;
  promoPct: number;
  avgPrice: number;
  score: number;
  rank: number;
};

type ParaProduct = {
  name: string;
  brand: string;
  category: string;
  img: string;
  minPrice: number;
  maxPrice: number;
  shopNames: string[];
  discount: number | null;
};

const PARA_DISPLAY_NAMES: Record<string, string> = {
  beautystore: "BeautyStore",
  el_farabi: "El Farabi",
  mapara: "MaPara",
  paraexpert: "ParaExpert",
  parafendri: "ParaFendri",
  parashop: "ParaShop",
  cosmetique: "Cosmétique",
  pharmashop: "PharmaShop",
  parahouse: "ParaHouse",
  paraland: "ParaLand",
};

function paraPretty(key: string): string {
  return PARA_DISPLAY_NAMES[key.toLowerCase()] ?? prettyName(key);
}

function paraLogoKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

let paraCache: ParaShop[] | null = null;

function getParaShops(): ParaShop[] {
  if (paraCache) return paraCache;

  const file = path.join(process.cwd(), "app/api/para-products/data.json");
  const products = JSON.parse(readFileSync(file, "utf8")) as ParaProduct[];

  const agg: Record<
    string,
    {
      products: number;
      priceSum: number;
      cheapestCount: number;
      promoCount: number;
    }
  > = {};

  for (const p of products) {
    if (!Array.isArray(p.shopNames) || p.shopNames.length === 0) continue;
    const cheapest = p.shopNames[0];
    const n = p.shopNames.length;

    p.shopNames.forEach((shop, i) => {
      const price =
        n === 1
          ? p.minPrice
          : p.minPrice + ((p.maxPrice - p.minPrice) * i) / Math.max(1, n - 1);
      if (!agg[shop]) {
        agg[shop] = { products: 0, priceSum: 0, cheapestCount: 0, promoCount: 0 };
      }
      agg[shop].products += 1;
      agg[shop].priceSum += price;
      if (shop === cheapest) agg[shop].cheapestCount += 1;
      if (p.discount && p.discount > 0) agg[shop].promoCount += 1;
    });
  }

  const maxCheapest = Math.max(
    ...Object.values(agg).map((a) => a.cheapestCount),
    1
  );
  const maxProducts = Math.max(
    ...Object.values(agg).map((a) => a.products),
    1
  );
  const avgPrices = Object.values(agg).map((a) =>
    a.products > 0 ? a.priceSum / a.products : 0
  );
  const minAvg = Math.min(...avgPrices);
  const maxAvg = Math.max(...avgPrices);

  const stats: ParaShop[] = Object.entries(agg).map(([shop, a]) => {
    const avgPrice = a.products > 0 ? a.priceSum / a.products : 0;
    const promoPct = a.products > 0 ? (a.promoCount / a.products) * 100 : 0;
    const bestPriceScore = (a.cheapestCount / maxCheapest) * 100;
    const priceLevelScore =
      maxAvg === minAvg ? 100 : ((maxAvg - avgPrice) / (maxAvg - minAvg)) * 100;
    const catalogScore = (a.products / maxProducts) * 100;
    const score =
      bestPriceScore * 0.45 + priceLevelScore * 0.25 + catalogScore * 0.3;

    return {
      shop,
      displayName: paraPretty(shop),
      logo: localShopLogo(paraLogoKey(shop)) ?? localShopLogo(shop),
      totalProducts: a.products,
      cheapestCount: a.cheapestCount,
      promoCount: a.promoCount,
      promoPct: Math.round(promoPct),
      avgPrice,
      score: Math.round(score),
      rank: 0,
    };
  });

  stats.sort((a, b) => b.score - a.score);
  stats.forEach((s, i) => (s.rank = i + 1));
  paraCache = stats;
  return paraCache;
}

// ── Supermarché shops (from grocery-crossing JSON) ──────────────

type SuperShop = {
  shop: string;
  displayName: string;
  logo: string | null;
  totalProducts: number;
  crossedProducts: number;
  cheapestWins: number;
  cheapestRatePct: number;
  crossingRatePct: number;
  rank: number;
};

function getSuperShops(): SuperShop[] {
  const file = path.join(
    process.cwd(),
    "lib/data/grocery-crossing-ranking.json"
  );
  const data = JSON.parse(readFileSync(file, "utf8"));

  const health: any[] = data.shop_health ?? [];

  const shops: SuperShop[] = health
    .map((s: any, i: number) => ({
      shop: s.shop_name,
      displayName: s.shop_name,
      logo: localShopLogo(s.shop_name) ?? localShopLogo(s.shop_name?.toLowerCase()?.replace(/\s+/g, "")),
      totalProducts: Number(s.total_products) || 0,
      crossedProducts: Number(s.crossed_products) || 0,
      cheapestCount: Number(s.cheapest_wins) || 0,
      cheapestWins: Number(s.cheapest_wins) || 0,
      cheapestRatePct: Number(s.cheapest_rate_pct) || 0,
      crossingRatePct: Number(s.crossing_rate_pct) || 0,
      rank: i + 1,
    }))
    .sort((a, b) => b.cheapestRatePct - a.cheapestRatePct);

  shops.forEach((s, i) => (s.rank = i + 1));
  return shops;
}

// ── Unified endpoint ────────────────────────────────────────────

export async function GET() {
  try {
    const [retail, para, supermarche] = await Promise.all([
      getRetailShops().catch(() => [] as RetailShop[]),
      Promise.resolve(getParaShops()),
      Promise.resolve(getSuperShops()),
    ]);

    return NextResponse.json(
      { retail, parapharmacie: para, supermarche: supermarche },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load classement data", retail: [], parapharmacie: [], supermarche: [] },
      { status: 200 }
    );
  }
}
