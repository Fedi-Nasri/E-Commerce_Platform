import { getClimStatsAsync } from "@/lib/climStats";
import { ClimStockSlider, type ClimSliderData } from "@/components/ClimStockSlider";

// Server component: PostgreSQL first, JSON fallback.
export async function ClimStockSection() {
  const clim = await getClimStatsAsync();

  const btuCards = clim.btuTiers.map((btu) => {
    const rows = clim.btuComparisonWithUrls(btu);
    return {
      btu,
      totalOffers: rows.reduce((a, r) => a + r.nb_annonces, 0),
      rows: rows.slice(0, 3).map((r, i) => ({
        rank: i + 1,
        shop: r.shop,
        shopName: clim.shopName(r.shop),
        prixMin: r.prix_min,
        prixMoyen: r.prix_moyen,
        nbAnnonces: r.nb_annonces,
        marqueMin: r.marques_au_prix_min[0] ?? "",
        url: r.url,
        title: r.title,
      })),
    };
  });

  const cheapestOffer = clim.cheapestOffers(1)[0] ?? null;

  const data: ClimSliderData = {
    totals: clim.totals,
    generatedAt: clim.generatedAt,
    cheapest: cheapestOffer
      ? { price: cheapestOffer.price, shopName: clim.shopName(cheapestOffer.shop), btu: cheapestOffer.btu }
      : null,
    btuCards,
    topBrands: clim.brandTotals.slice(0, 8).map((b) => ({
      brand: b.brand,
      label: clim.brandLabel(b.brand),
      count: b.count,
      logo: clim.brandLogo(b.brand),
    })),
  };

  return <ClimStockSlider data={data} />;
}
