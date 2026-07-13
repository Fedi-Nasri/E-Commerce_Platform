/** Client-safe types and helpers for shop average price ticker. */

export type ShopAvgPriceRow = {
  rank: number;
  shop_key: string;
  display_name?: string;
  product_count: number;
  price_sum: number;
  avg_price: number;
  volume_tier?: string;
  scrape_folder?: string;
  avg_price_rank?: number;
  catalog_rank?: number;
  accessibility_pct?: number;
  catalog_share_pct?: number;
};

export type RetailShopAvgPrices = {
  generated_at: string;
  method: string;
  in_stock_only?: boolean;
  stock_dir?: string | null;
  shop_count: number;
  total_products: number;
  median_avg_price?: number;
  featured_min_products?: number;
  shops: ShopAvgPriceRow[];
  skipped?: Array<{ shop: string; reason: string }>;
};

export function displayPrice(shop: ShopAvgPriceRow): number {
  return shop.avg_price;
}

export function fmtTickerPrice(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

export function shopTickerSymbol(key: string): string {
  const clean = key.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return clean.length <= 5 ? clean : clean.slice(0, 5);
}
