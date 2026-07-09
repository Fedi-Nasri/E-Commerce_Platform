import {
  climBrandLabel,
  climBrandLogo,
  climBrandTotals,
  climBtuComparisonWithUrls,
  climBtuTiers,
  climCheapestOffers,
  climGeneratedAt,
  climShopName,
  climTotals,
} from "@/lib/climStats";
import { ClimStockSlider, type ClimSliderData } from "@/components/ClimStockSlider";

// Server component: reads the (large) snapshot JSON on the server and passes a
// small computed summary to the client slider.
export function ClimStockSection() {
  const btuCards = climBtuTiers.map((btu) => {
    const rows = climBtuComparisonWithUrls(btu);
    return {
      btu,
      totalOffers: rows.reduce((a, r) => a + r.nb_annonces, 0),
      rows: rows.slice(0, 3).map((r, i) => ({
        rank: i + 1,
        shop: r.shop,
        shopName: climShopName(r.shop),
        prixMin: r.prix_min,
        prixMoyen: r.prix_moyen,
        nbAnnonces: r.nb_annonces,
        marqueMin: r.marques_au_prix_min[0] ?? "",
        url: r.url,
        title: r.title,
      })),
    };
  });

  const cheapestOffer = climCheapestOffers(1)[0] ?? null;

  const data: ClimSliderData = {
    totals: climTotals,
    generatedAt: climGeneratedAt,
    cheapest: cheapestOffer
      ? { price: cheapestOffer.price, shopName: climShopName(cheapestOffer.shop), btu: cheapestOffer.btu }
      : null,
    btuCards,
    topBrands: climBrandTotals.slice(0, 8).map((b) => ({
      brand: b.brand,
      label: climBrandLabel(b.brand),
      count: b.count,
      logo: climBrandLogo(b.brand),
    })),
  };

  return <ClimStockSlider data={data} />;
}
