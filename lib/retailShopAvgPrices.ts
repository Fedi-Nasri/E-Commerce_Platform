import raw from "@/lib/data/retailShopAvgPrices.json";

export type ShopAvgPriceRow = {
  rank: number;
  shop_key: string;
  product_count: number;
  price_sum: number;
  avg_price: number;
  adj_avg_price: number;
  price_index?: number;
  adj_index?: number;
  vs_market_pct: number;
  volume_tier?: string;
  by_segment: Record<string, number>;
};

export type RetailShopAvgPrices = {
  generated_at: string;
  method: string;
  segments: string[];
  market_avg_by_segment?: Record<string, number>;
  market_avg_price: number;
  shop_count: number;
  total_products: number;
  shops: ShopAvgPriceRow[];
};

const data = raw as unknown as RetailShopAvgPrices;

export function getRetailShopAvgPrices(): RetailShopAvgPrices {
  return data;
}

/** Primary display price (mix-adjusted + shrinkage). */
export function displayPrice(shop: ShopAvgPriceRow): number {
  return shop.adj_avg_price ?? shop.avg_price;
}

export function fmtTickerPrice(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

export function shopTickerSymbol(key: string): string {
  const clean = key.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return clean.length <= 5 ? clean : clean.slice(0, 5);
}
