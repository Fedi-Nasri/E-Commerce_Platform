import raw from "@/lib/data/topRetailShops.json";
import { localShopLogo } from "@/lib/shopLogos";
import { shopDisplayName } from "@/lib/priceRankings";

export type TopRetailShopRow = {
  rank: number;
  shop: string;
  totalProducts: number;
  cheapestCount: number;
  competitionScore: number;
  competitiveCount: number;
  competitivePct: number;
  similarProducts: number;
  overlapPct: number;
  winRatePct: number;
};

export type TopRetailCategoryRow = {
  slug: string;
  label: string;
  clusterCount: number;
  leader: string | null;
  shops: {
    shop: string;
    totalProducts: number;
    cheapestCount: number;
    winRatePct: number;
  }[];
};

export type TopRetailShopsData = {
  generated_at: string;
  source: string;
  stock_dir?: string | null;
  method: string;
  clusters_used: number;
  scrapes_used?: number;
  min_products: number;
  min_products_list?: number;
  in_stock_only?: boolean;
  shops: TopRetailShopRow[];
  allShops?: TopRetailShopRow[];
  categories?: TopRetailCategoryRow[];
};

const data = raw as unknown as TopRetailShopsData;

export function getTopRetailShopsData(): TopRetailShopsData {
  return data;
}

export async function getTopRetailShopsDataForApi(): Promise<TopRetailShopsData> {
  const { getTopRetailStatsFromDb } = await import("@/lib/homepageStatsDb");
  const fromDb = await getTopRetailStatsFromDb();
  return fromDb ?? data;
}

function enrichShop(s: TopRetailShopRow) {
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

export function getTopRetailShopsForApi() {
  return data.shops.map(enrichShop);
}

export async function getTopRetailShopsForApiAsync() {
  const { getTopRetailStatsFromDb, enrichTopRetailShopForApi } = await import("@/lib/homepageStatsDb");
  const bundle = await getTopRetailStatsFromDb();
  const shops = bundle?.shops ?? data.shops;
  return shops.map((s) => enrichTopRetailShopForApi(s));
}

export function getTopRetailRankingForApi() {
  const all = data.allShops ?? data.shops;
  return {
    generatedAt: data.generated_at,
    method: data.method,
    clustersUsed: data.clusters_used,
    scrapesUsed: data.scrapes_used ?? null,
    stockDir: data.stock_dir ?? null,
    minProducts: data.min_products,
    minProductsList: data.min_products_list ?? 50,
    inStockOnly: data.in_stock_only ?? true,
    shops: all.map(enrichShop),
    top5: data.shops.map(enrichShop),
    categories: (data.categories ?? []).map((c) => ({
      ...c,
      leaderName: c.leader ? shopDisplayName(c.leader) : null,
      shops: c.shops.map((s) => ({
        ...s,
        displayName: shopDisplayName(s.shop),
        logo: localShopLogo(s.shop),
      })),
    })),
  };
}

export async function getTopRetailRankingForApiAsync() {
  const { getTopRetailStatsFromDb, enrichTopRetailShopForApi } = await import("@/lib/homepageStatsDb");
  const bundle = await getTopRetailStatsFromDb();
  const source = bundle ?? data;
  const all = source.allShops ?? source.shops;
  return {
    generatedAt: source.generated_at,
    method: source.method,
    clustersUsed: source.clusters_used,
    scrapesUsed: source.scrapes_used ?? null,
    stockDir: source.stock_dir ?? null,
    minProducts: source.min_products,
    minProductsList: source.min_products_list ?? 50,
    inStockOnly: source.in_stock_only ?? true,
    shops: all.map((s) => enrichTopRetailShopForApi(s)),
    top5: source.shops.map((s) => enrichTopRetailShopForApi(s)),
    categories: (source.categories ?? []).map((c) => ({
      ...c,
      leaderName: c.leader ? shopDisplayName(c.leader) : null,
      shops: c.shops.map((s) => ({
        ...s,
        displayName: shopDisplayName(s.shop),
        logo: localShopLogo(s.shop),
      })),
    })),
  };
}
