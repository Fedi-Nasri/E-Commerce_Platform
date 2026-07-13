import { ShopMarketTicker } from "@/components/ShopMarketTicker";
import { getRetailShopAvgPricesForApi } from "@/lib/retailShopAvgPrices";

export async function ShopMarketSection() {
  const data = await getRetailShopAvgPricesForApi();
  return <ShopMarketTicker initial={data} />;
}
