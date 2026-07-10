import raw from "@/lib/data/paraSunscreenOffers.json";

export type ParaSunscreenOffer = {
  rank: number;
  shop: string;
  displayName: string;
  name: string;
  url: string;
  price: number;
  regular: number | null;
  title: string | null;
  inStock: boolean;
};

export type ParaSunscreenOffersData = {
  generated_at: string;
  stock_dir?: string | null;
  product: {
    label: string;
    subtitle: string;
    image: string;
  };
  shopsTracked: number;
  offers: ParaSunscreenOffer[];
  maxSavings: number;
  leaderShop: string | null;
};

const data = raw as unknown as ParaSunscreenOffersData;

export function getParaSunscreenOffersForApi() {
  return data;
}
