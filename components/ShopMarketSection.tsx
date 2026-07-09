import { ShopMarketTicker } from "@/components/ShopMarketTicker";
import { getRetailShopAvgPrices } from "@/lib/retailShopAvgPrices";

export function ShopMarketSection() {
  const data = getRetailShopAvgPrices();
  return <ShopMarketTicker initial={data} />;
}
