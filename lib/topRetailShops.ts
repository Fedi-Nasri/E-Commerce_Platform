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

export type TopRetailShopsData = {
  generated_at: string;
  source: string;
  stock_dir?: string | null;
  method: string;
  clusters_used: number;
  min_products: number;
  in_stock_only?: boolean;
  shops: TopRetailShopRow[];
};

const data = raw as unknown as TopRetailShopsData;

export function getTopRetailShopsData(): TopRetailShopsData {
  return data;
}

export function getTopRetailShopsForApi() {
  return data.shops.map((s) => ({
    shop: s.shop,
    displayName: shopDisplayName(s.shop),
    logo: localShopLogo(s.shop),
    totalProducts: s.totalProducts,
    similarProducts: s.similarProducts,
    cheapestCount: s.cheapestCount,
    competitionScore: s.competitionScore,
    competitiveCount: s.competitiveCount,
    competitivePct: s.competitivePct,
    winRatePct: s.winRatePct ?? (s.totalProducts > 0 ? Math.round((s.cheapestCount / s.totalProducts) * 100) : 0),
  }));
}
