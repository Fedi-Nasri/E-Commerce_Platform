import { shopDisplayName } from "@/lib/priceRankings";
import { getRetailShopAvgPrices, type ShopAvgPriceRow } from "@/lib/retailShopAvgPrices";
import { getTopRetailShopsData } from "@/lib/topRetailShops";
import { loadShopPriceBuckets, type PriceBucketRow } from "@/lib/shopCatalogScrape";

export type ShopCatalogPeer = {
  shop_key: string;
  displayName: string;
  avg_price: number;
  product_count: number;
  isSelected: boolean;
};

export type ShopCompetitiveStats = {
  rank: number;
  totalProducts: number;
  cheapestCount: number;
  winRatePct: number;
  competitivePct: number;
};

export type ShopCatalogDetail = {
  shop: ShopAvgPriceRow;
  displayName: string;
  priceBuckets: PriceBucketRow[] | null;
  market: {
    shopCount: number;
    totalProducts: number;
    medianAvgPrice: number;
    avgPriceRank: number;
    catalogRank: number;
    accessibilityPct: number;
    catalogSharePct: number;
  };
  peers: ShopCatalogPeer[];
  competitive: ShopCompetitiveStats | null;
};

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
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

export function getShopCatalogDetailFromJson(shopKey: string): ShopCatalogDetail | null {
  const data = getRetailShopAvgPrices();
  const shop = data.shops.find((s) => s.shop_key === shopKey);
  if (!shop) return null;

  const shops = data.shops;
  const byAvg = [...shops].sort((a, b) => a.avg_price - b.avg_price);
  const byCatalog = [...shops].sort((a, b) => b.product_count - a.product_count);

  const avgPriceRank = byAvg.findIndex((s) => s.shop_key === shopKey) + 1;
  const catalogRank = byCatalog.findIndex((s) => s.shop_key === shopKey) + 1;
  const accessibilityPct =
    shops.length > 1
      ? Math.round(((shops.length - avgPriceRank) / (shops.length - 1)) * 100)
      : 100;

  const retailRank = getTopRetailShopsData();
  const competitiveRow =
    retailRank.allShops?.find((s) => s.shop === shopKey) ??
    retailRank.shops.find((s) => s.shop === shopKey) ??
    null;

  return {
    shop,
    displayName: shopDisplayName(shopKey),
    priceBuckets: loadShopPriceBuckets(shopKey),
    market: {
      shopCount: data.shop_count,
      totalProducts: data.total_products,
      medianAvgPrice: Math.round(median(shops.map((s) => s.avg_price)) * 100) / 100,
      avgPriceRank,
      catalogRank,
      accessibilityPct,
      catalogSharePct:
        data.total_products > 0
          ? Math.round((shop.product_count / data.total_products) * 1000) / 10
          : 0,
    },
    peers: pickPeers(shops, shop),
    competitive: competitiveRow
      ? {
          rank: competitiveRow.rank,
          totalProducts: competitiveRow.totalProducts,
          cheapestCount: competitiveRow.cheapestCount,
          winRatePct: competitiveRow.winRatePct,
          competitivePct: competitiveRow.competitivePct,
        }
      : null,
  };
}

/** PostgreSQL first, then JSON + scrape fallback. */
export async function getShopCatalogDetailForApi(shopKey: string): Promise<ShopCatalogDetail | null> {
  const { getShopCatalogDetailFromDb } = await import("@/lib/homepageStatsDb");
  const fromDb = await getShopCatalogDetailFromDb(shopKey);
  if (fromDb) return fromDb;
  return getShopCatalogDetailFromJson(shopKey);
}
