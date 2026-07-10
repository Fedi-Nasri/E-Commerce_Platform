import "server-only";
import raw from "@/lib/data/retailShopAvgPrices.json";
import type { RetailShopAvgPrices } from "@/lib/shopAvgPriceUtils";

export type { ShopAvgPriceRow, RetailShopAvgPrices } from "@/lib/shopAvgPriceUtils";
export { displayPrice, fmtTickerPrice, shopTickerSymbol } from "@/lib/shopAvgPriceUtils";

const data = raw as unknown as RetailShopAvgPrices;

/** JSON fallback (build / offline). */
export function getRetailShopAvgPrices(): RetailShopAvgPrices {
  return data;
}

/** PostgreSQL first, then JSON fallback. */
export async function getRetailShopAvgPricesForApi(): Promise<RetailShopAvgPrices> {
  const { getRetailShopAvgPricesFromDb } = await import("@/lib/homepageStatsDb");
  const fromDb = await getRetailShopAvgPricesFromDb();
  if (fromDb) return fromDb;
  return data;
}
