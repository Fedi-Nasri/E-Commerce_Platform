import raw from "@/lib/data/topParaShops.json";
import { localShopLogo } from "@/lib/shopLogos";

export type TopParaShopRow = {
  rank: number;
  shop: string;
  products: number;
  comparedProducts?: number;
  catalogProducts?: number | null;
  catalogTotal?: number | null;
  cheapestCount: number;
  cheapestCountExact?: number;
  avgPrice: number;
  promoCount: number;
  promoPct: number;
  availability: number;
  winRatePct: number;
  score: number;
  visitors: number;
};

export type TopParaShopsData = {
  generated_at: string;
  source: string;
  stock_dir?: string | null;
  scrapes_used?: number;
  method: string;
  clusters_used: number;
  min_products: number;
  in_stock_only?: boolean;
  shops: TopParaShopRow[];
};

const DISPLAY_NAMES: Record<string, string> = {
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

const data = raw as unknown as TopParaShopsData;

export function getTopParaShopsData(): TopParaShopsData {
  return data;
}

export async function getTopParaShopsDataForApi(): Promise<TopParaShopsData> {
  const { getTopParaStatsFromDb } = await import("@/lib/homepageStatsDb");
  const fromDb = await getTopParaStatsFromDb();
  return fromDb ?? data;
}

function prettyName(shop: string): string {
  return DISPLAY_NAMES[shop.toLowerCase()] ?? shop.charAt(0).toUpperCase() + shop.slice(1);
}

export function getTopParaShopsForApi() {
  return data.shops.map((s) => ({
    shop: s.shop,
    displayName: prettyName(s.shop),
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
  }));
}

export async function getTopParaShopsForApiAsync() {
  const { getTopParaStatsFromDb, enrichTopParaShopForApi } = await import("@/lib/homepageStatsDb");
  const bundle = await getTopParaStatsFromDb();
  const shops = bundle?.shops ?? data.shops;
  return shops.map((s) => enrichTopParaShopForApi(s));
}
