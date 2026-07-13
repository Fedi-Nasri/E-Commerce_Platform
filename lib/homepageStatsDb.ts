/**
 * PostgreSQL readers for homepage stats tables.
 * Each dataset: stats_{name}_runs + stats_{name}_* rows (run_key = 'latest').
 */
import "server-only";
import { retailPool } from "@/lib/db";
import { shopDisplayName } from "@/lib/priceRankings";
import { localShopLogo } from "@/lib/shopLogos";
import type { ShopAvgPriceRow, RetailShopAvgPrices } from "@/lib/shopAvgPriceUtils";
import type { PriceBucketRow } from "@/lib/shopCatalogScrape";
import type { ShopCatalogDetail, ShopCatalogPeer, ShopCompetitiveStats } from "@/lib/shopCatalogDetail";
import type { TopParaShopRow, TopParaShopsData } from "@/lib/topParaShops";
import type { TopRetailShopRow, TopRetailShopsData } from "@/lib/topRetailShops";

export type PrixMoyenRunRow = {
  id: number;
  run_key: string;
  method: string;
  in_stock_only: boolean;
  stock_dir: string | null;
  shop_count: number;
  total_products: number;
  median_avg_price: number;
  featured_min_products: number;
  generated_at: string;
};

const PARA_DISPLAY: Record<string, string> = {
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
  pharmacieplus: "PharmaciePlus",
  tunisiepara: "TunisiePara",
  lagrandepara: "La Grande Para",
};

function paraPretty(shop: string): string {
  return PARA_DISPLAY[shop.toLowerCase()] ?? shopDisplayName(shop);
}

function pickPeers(shops: ShopAvgPriceRow[], selected: ShopAvgPriceRow): ShopCatalogPeer[] {
  const sorted = [...shops].sort(
    (a, b) =>
      Math.abs(a.product_count - selected.product_count) -
      Math.abs(b.product_count - selected.product_count),
  );
  const picked = new Map<string, ShopAvgPriceRow>();
  picked.set(selected.shop_key, selected);
  for (const s of sorted) {
    if (picked.size >= 5) break;
    if (s.shop_key !== selected.shop_key) picked.set(s.shop_key, s);
  }
  return [...picked.values()]
    .sort((a, b) => a.avg_price - b.avg_price)
    .map((s) => ({
      shop_key: s.shop_key,
      displayName: shopDisplayName(s.shop_key),
      avg_price: s.avg_price,
      product_count: s.product_count,
      isSelected: s.shop_key === selected.shop_key,
    }));
}

async function latestRunId(table: string): Promise<number | null> {
  try {
    const res = await retailPool().query<{ id: number }>(
      `SELECT id FROM ${table} WHERE run_key = 'latest' ORDER BY generated_at DESC LIMIT 1`,
    );
    return res.rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function getPrixMoyenRunFromDb(): Promise<PrixMoyenRunRow | null> {
  try {
    const res = await retailPool().query<PrixMoyenRunRow>(
      `SELECT id, run_key, method, in_stock_only, stock_dir, shop_count, total_products,
              median_avg_price::float AS median_avg_price, featured_min_products, generated_at
       FROM stats_prix_moyen_runs WHERE run_key = 'latest' ORDER BY generated_at DESC LIMIT 1`,
    );
    return res.rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function getPrixMoyenStatsFromDb(): Promise<{
  run: PrixMoyenRunRow;
  shops: ShopAvgPriceRow[];
} | null> {
  const run = await getPrixMoyenRunFromDb();
  if (!run) return null;
  try {
    const res = await retailPool().query(
      `SELECT shop_key, display_name, product_count, price_sum::float AS price_sum,
              avg_price::float AS avg_price, volume_tier, avg_price_rank AS rank,
              catalog_rank, accessibility_pct, catalog_share_pct, scrape_folder
       FROM stats_prix_moyen_shops WHERE run_id = $1 ORDER BY catalog_rank ASC`,
      [run.id],
    );
    const shops: ShopAvgPriceRow[] = res.rows.map((r) => ({
      shop_key: r.shop_key,
      display_name: r.display_name ?? undefined,
      product_count: Number(r.product_count),
      price_sum: Number(r.price_sum),
      avg_price: Number(r.avg_price),
      rank: Number(r.rank),
      volume_tier: r.volume_tier ?? undefined,
      scrape_folder: r.scrape_folder ?? undefined,
      avg_price_rank: Number(r.rank),
      catalog_rank: Number(r.catalog_rank),
      accessibility_pct: Number(r.accessibility_pct),
      catalog_share_pct: Number(r.catalog_share_pct),
    }));
    return { run, shops };
  } catch {
    return null;
  }
}

export async function getRetailShopAvgPricesFromDb(): Promise<RetailShopAvgPrices | null> {
  const bundle = await getPrixMoyenStatsFromDb();
  if (!bundle) return null;
  const { run, shops } = bundle;
  return {
    generated_at: run.generated_at,
    method: run.method,
    in_stock_only: run.in_stock_only,
    stock_dir: run.stock_dir,
    shop_count: run.shop_count,
    total_products: run.total_products,
    median_avg_price: run.median_avg_price,
    featured_min_products: run.featured_min_products,
    shops,
  };
}

export async function getShopCatalogDetailFromDb(shopKey: string): Promise<ShopCatalogDetail | null> {
  const bundle = await getPrixMoyenStatsFromDb();
  if (!bundle) return null;
  const { run, shops } = bundle;
  const shop = shops.find((s) => s.shop_key === shopKey);
  if (!shop) return null;

  const client = await retailPool().connect();
  try {
    const bucketRes = await client.query(
      `SELECT bucket_label, product_count, share_pct::float AS share_pct
       FROM stats_prix_moyen_buckets WHERE run_id = $1 AND shop_key = $2 ORDER BY bucket_order`,
      [run.id, shopKey],
    );

    const runIdRetail = await latestRunId("stats_top_retail_runs");
    let competitive: ShopCompetitiveStats | null = null;
    if (runIdRetail) {
      const compRes = await client.query(
        `SELECT rank, total_products_compared, cheapest_count,
                win_rate_pct::float AS win_rate_pct, competitive_pct::float AS competitive_pct
         FROM stats_top_retail_shops WHERE run_id = $1 AND shop_key = $2 LIMIT 1`,
        [runIdRetail, shopKey],
      );
      const c = compRes.rows[0];
      if (c) {
        competitive = {
          rank: Number(c.rank),
          totalProducts: Number(c.total_products_compared),
          cheapestCount: Number(c.cheapest_count),
          winRatePct: Number(c.win_rate_pct),
          competitivePct: Number(c.competitive_pct),
        };
      }
    }

    const priceBuckets: PriceBucketRow[] | null =
      bucketRes.rows.length > 0
        ? bucketRes.rows.map((r) => ({
            label: r.bucket_label,
            count: Number(r.product_count),
            pct: Number(r.share_pct),
          }))
        : null;

    return {
      shop: {
        shop_key: shop.shop_key,
        display_name: shop.display_name,
        product_count: shop.product_count,
        price_sum: shop.price_sum,
        avg_price: shop.avg_price,
        rank: shop.rank,
        volume_tier: shop.volume_tier,
        scrape_folder: shop.scrape_folder,
      },
      displayName: shopDisplayName(shopKey),
      priceBuckets,
      market: {
        shopCount: run.shop_count,
        totalProducts: run.total_products,
        medianAvgPrice: Number(run.median_avg_price),
        avgPriceRank: shop.avg_price_rank ?? shop.rank,
        catalogRank: shop.catalog_rank ?? 1,
        accessibilityPct: shop.accessibility_pct ?? 0,
        catalogSharePct: shop.catalog_share_pct ?? 0,
      },
      peers: pickPeers(shops, shop),
      competitive,
    };
  } finally {
    client.release();
  }
}

export async function getTopRetailStatsFromDb(): Promise<TopRetailShopsData | null> {
  try {
    const runRes = await retailPool().query(
      `SELECT id, method, source, stock_dir, clusters_used, scrapes_used,
              min_products, min_products_list, in_stock_only, generated_at
       FROM stats_top_retail_runs WHERE run_key = 'latest' ORDER BY generated_at DESC LIMIT 1`,
    );
    const run = runRes.rows[0];
    if (!run) return null;

    const shopsRes = await retailPool().query(
      `SELECT shop_key, rank, is_top5, total_products_compared, cheapest_count,
              competition_score::float, competitive_count, competitive_pct,
              similar_products, overlap_pct, win_rate_pct
       FROM stats_top_retail_shops WHERE run_id = $1 ORDER BY rank ASC`,
      [run.id],
    );

    const mapRow = (r: Record<string, unknown>): TopRetailShopRow => ({
      rank: Number(r.rank),
      shop: String(r.shop_key),
      totalProducts: Number(r.total_products_compared),
      cheapestCount: Number(r.cheapest_count),
      competitionScore: Number(r.competition_score),
      competitiveCount: Number(r.competitive_count),
      competitivePct: Number(r.competitive_pct),
      similarProducts: Number(r.similar_products),
      overlapPct: Number(r.overlap_pct),
      winRatePct: Number(r.win_rate_pct),
    });

    const allShops = shopsRes.rows.map(mapRow);
    const shops = shopsRes.rows.filter((r) => r.is_top5).map(mapRow);

    return {
      generated_at: run.generated_at,
      source: run.source ?? "",
      stock_dir: run.stock_dir,
      method: run.method ?? "",
      clusters_used: Number(run.clusters_used),
      scrapes_used: run.scrapes_used != null ? Number(run.scrapes_used) : undefined,
      min_products: Number(run.min_products),
      min_products_list: run.min_products_list != null ? Number(run.min_products_list) : undefined,
      in_stock_only: run.in_stock_only,
      shops,
      allShops,
    };
  } catch {
    return null;
  }
}

export async function getTopParaStatsFromDb(): Promise<TopParaShopsData | null> {
  try {
    const runRes = await retailPool().query(
      `SELECT id, method, source, stock_dir, clusters_used, scrapes_used,
              min_products, in_stock_only, generated_at
       FROM stats_para_runs WHERE run_key = 'latest' ORDER BY generated_at DESC LIMIT 1`,
    );
    const run = runRes.rows[0];
    if (!run) return null;

    const shopsRes = await retailPool().query(
      `SELECT shop_key, rank, products_compared, catalog_products, catalog_total,
              cheapest_count::float, avg_price::float, promo_count, promo_pct,
              availability_pct, win_rate_pct, score, visitors
       FROM stats_para_shops WHERE run_id = $1 ORDER BY rank ASC`,
      [run.id],
    );

    const shops: TopParaShopRow[] = shopsRes.rows.map((r) => ({
      rank: Number(r.rank),
      shop: String(r.shop_key),
      products: Number(r.products_compared),
      comparedProducts: Number(r.products_compared),
      catalogProducts: r.catalog_products != null ? Number(r.catalog_products) : null,
      catalogTotal: r.catalog_total != null ? Number(r.catalog_total) : null,
      cheapestCount: Math.round(Number(r.cheapest_count)),
      cheapestCountExact: Number(r.cheapest_count),
      avgPrice: Number(r.avg_price),
      promoCount: Number(r.promo_count),
      promoPct: Number(r.promo_pct),
      availability: Number(r.availability_pct),
      winRatePct: Number(r.win_rate_pct),
      score: Number(r.score),
      visitors: Number(r.visitors),
    }));

    return {
      generated_at: run.generated_at,
      source: run.source ?? "",
      stock_dir: run.stock_dir,
      scrapes_used: run.scrapes_used != null ? Number(run.scrapes_used) : undefined,
      method: run.method ?? "",
      clusters_used: Number(run.clusters_used),
      min_products: Number(run.min_products),
      in_stock_only: run.in_stock_only,
      shops,
    };
  } catch {
    return null;
  }
}

export function enrichTopRetailShopForApi(s: TopRetailShopRow) {
  return {
    shop: s.shop,
    displayName: shopDisplayName(s.shop),
    logo: localShopLogo(s.shop),
    rank: s.rank,
    totalProducts: s.totalProducts,
    similarProducts: s.similarProducts,
    cheapestCount: s.cheapestCount,
    competitionScore: s.competitionScore,
    competitiveCount: s.competitiveCount,
    competitivePct: s.competitivePct,
    winRatePct: s.winRatePct ?? (s.totalProducts > 0 ? Math.round((s.cheapestCount / s.totalProducts) * 100) : 0),
  };
}

export type ClimStockFileFromDb = {
  generated_at: string;
  mode: string;
  totaux: { climatiseurs: number; boutiques: number; marques: number };
  par_boutique: Array<{
    shop: string;
    scrape: string;
    total_climatiseurs: number;
    marques: Record<string, number>;
    par_btu: Record<string, number>;
    moins_cher: { prix: number | null; marque: string | null; titre: string | null; btu: string | null } | null;
  }>;
  comparaison_globale_par_btu: Record<
    string,
    Array<{
      shop: string;
      prix_min: number;
      prix_moyen: number;
      nb_annonces: number;
      marques_au_prix_min: string[];
    }>
  >;
  annonces: Array<{
    shop: string;
    title: string;
    brand: string | null;
    btu: string | null;
    tech: string | null;
    price: number | null;
    url: string;
    in_stock: boolean;
    stock_label: string | null;
    scrape: string;
  }>;
};

export async function getClimStockFileFromDb(): Promise<ClimStockFileFromDb | null> {
  try {
    const runRes = await retailPool().query(
      `SELECT id, mode, total_climatiseurs, total_boutiques, total_marques, annonces_json, generated_at
       FROM stats_climatiseurs_runs WHERE run_key = 'latest' ORDER BY generated_at DESC LIMIT 1`,
    );
    const run = runRes.rows[0];
    if (!run) return null;

    const shopsRes = await retailPool().query(
      `SELECT shop_key, scrape_folder, total_climatiseurs, marques_json, par_btu_json, moins_cher_json
       FROM stats_climatiseurs_shops WHERE run_id = $1`,
      [run.id],
    );

    const btuRes = await retailPool().query(
      `SELECT btu_tier, shop_key, prix_min, prix_moyen, nb_annonces, marques_au_prix_min
       FROM stats_climatiseurs_btu WHERE run_id = $1 ORDER BY btu_tier::int, prix_min`,
      [run.id],
    );

    const comparaison: ClimStockFileFromDb["comparaison_globale_par_btu"] = {};
    for (const r of btuRes.rows) {
      const btu = String(r.btu_tier);
      if (!comparaison[btu]) comparaison[btu] = [];
      comparaison[btu].push({
        shop: String(r.shop_key),
        prix_min: Number(r.prix_min),
        prix_moyen: Number(r.prix_moyen),
        nb_annonces: Number(r.nb_annonces),
        marques_au_prix_min: String(r.marques_au_prix_min ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
    }

    const annonces = Array.isArray(run.annonces_json) ? run.annonces_json : [];

    return {
      generated_at: run.generated_at,
      mode: run.mode ?? "en_stock",
      totaux: {
        climatiseurs: Number(run.total_climatiseurs),
        boutiques: Number(run.total_boutiques),
        marques: Number(run.total_marques),
      },
      par_boutique: shopsRes.rows.map((s) => ({
        shop: String(s.shop_key),
        scrape: String(s.scrape_folder ?? ""),
        total_climatiseurs: Number(s.total_climatiseurs),
        marques: (s.marques_json as Record<string, number>) ?? {},
        par_btu: (s.par_btu_json as Record<string, number>) ?? {},
        moins_cher: (s.moins_cher_json as ClimStockFileFromDb["par_boutique"][0]["moins_cher"]) ?? null,
      })),
      comparaison_globale_par_btu: comparaison,
      annonces,
    };
  } catch {
    return null;
  }
}

export function enrichTopParaShopForApi(s: TopParaShopRow) {
  return {
    shop: s.shop,
    displayName: paraPretty(s.shop),
    products: s.products,
    comparedProducts: s.comparedProducts ?? s.products,
    catalogProducts: s.catalogProducts ?? null,
    catalogTotal: s.catalogTotal ?? null,
    avgPrice: s.avgPrice,
    cheapestCount: s.cheapestCount,
    promoCount: s.promoCount,
    promoPct: s.promoPct,
    availability: s.availability,
    score: s.score,
    rank: s.rank,
    logo: localShopLogo(s.shop),
    visitors: s.visitors,
    winRatePct: s.winRatePct,
  };
}
