import "server-only";
import raw from "@/lib/data/climatiseursEnStock.json";
import { climBrandHref, climBrandSlug } from "@/lib/climBrandUtils";
import {
  climBrandLabel,
  climBrandLogo,
  climShopName,
  formatDT,
  type ClimOffer,
} from "@/lib/climDisplay";

export { climBrandHref, climBrandSlug };
export { climShopName, climBrandLabel, climBrandLogo, formatDT, type ClimOffer };

// Server-side module for the "Climatiseurs en stock" stats (scraped snapshot).
// Import only from server components / API routes — the JSON is ~370 KB.

export type ClimAnnonce = {
  shop: string;
  title: string;
  brand: string | null;
  btu: string | null;
  tech: string | null;
  price: number | null;
  url: string;
  in_stock: boolean;
  stock_label: string | null;
  scrape: string;
};

export type ClimShopStock = {
  shop: string;
  scrape: string;
  total_climatiseurs: number;
  marques: Record<string, number>;
  par_btu: Record<string, number>;
  moins_cher: { prix: number | null; marque: string | null; titre: string | null; btu: string | null } | null;
};

export type ClimBtuRow = {
  shop: string;
  prix_min: number;
  prix_moyen: number;
  nb_annonces: number;
  marques_au_prix_min: string[];
};

export type ClimBtuRowWithUrl = ClimBtuRow & {
  url: string | null;
  title: string | null;
};

type ClimStockFile = {
  generated_at: string;
  mode: string;
  totaux: { climatiseurs: number; boutiques: number; marques: number };
  par_boutique: ClimShopStock[];
  comparaison_globale_par_btu: Record<string, ClimBtuRow[]>;
  annonces: ClimAnnonce[];
};

const data = raw as unknown as ClimStockFile;

/** PostgreSQL first, then JSON fallback. */
export async function resolveClimStockFile(): Promise<ClimStockFile> {
  const { getClimStockFileFromDb } = await import("@/lib/homepageStatsDb");
  const fromDb = await getClimStockFileFromDb();
  return (fromDb as ClimStockFile) ?? data;
}

function btuTiersFrom(file: ClimStockFile): string[] {
  return Object.keys(file.comparaison_globale_par_btu).sort((a, b) => Number(a) - Number(b));
}

function btuComparisonFrom(file: ClimStockFile, btu: string): ClimBtuRow[] {
  return file.comparaison_globale_par_btu[btu] ?? [];
}

function btuRowOfferFrom(file: ClimStockFile, btu: string, row: ClimBtuRow): Pick<ClimOffer, "url" | "title"> | null {
  const brands = new Set(row.marques_au_prix_min.map((b) => b.toLowerCase()));
  const target = Math.round(row.prix_min);

  const pick = (requireBrand: boolean): ClimAnnonce | null => {
    let best: ClimAnnonce | null = null;
    let bestPrice = Infinity;
    for (const a of file.annonces) {
      if (a.shop !== row.shop || a.btu !== btu || !a.url) continue;
      const price = normalizedPrice(a);
      if (price == null || Math.round(price) !== target) continue;
      if (requireBrand && brands.size && a.brand && !brands.has(a.brand.toLowerCase())) continue;
      if (price < bestPrice) {
        best = a;
        bestPrice = price;
      }
    }
    return best;
  };

  const hit = pick(true) ?? pick(false);
  if (!hit) return null;
  return { url: hit.url, title: hit.title };
}

function btuComparisonWithUrlsFrom(file: ClimStockFile, btu: string): ClimBtuRowWithUrl[] {
  return btuComparisonFrom(file, btu).map((row) => {
    const offer = btuRowOfferFrom(file, btu, row);
    return { ...row, url: offer?.url ?? null, title: offer?.title ?? null };
  });
}

function shopsFrom(file: ClimStockFile): ClimShopStock[] {
  return [...file.par_boutique].sort((a, b) => b.total_climatiseurs - a.total_climatiseurs);
}

function brandTotalsFrom(file: ClimStockFile): { brand: string; count: number }[] {
  const acc = new Map<string, number>();
  for (const s of file.par_boutique) {
    for (const [brand, n] of Object.entries(s.marques)) {
      acc.set(brand, (acc.get(brand) ?? 0) + n);
    }
  }
  return [...acc.entries()]
    .map(([brand, count]) => ({ brand, count }))
    .sort((a, b) => b.count - a.count);
}

function cheapestOffersFrom(file: ClimStockFile, limit = 12, btu?: string): ClimOffer[] {
  const seen = new Set<string>();
  const out: ClimOffer[] = [];
  const candidates = file.annonces
    .filter((a) => a.btu != null && (!btu || a.btu === btu))
    .map((a) => ({ a, price: normalizedPrice(a) }))
    .filter((x): x is { a: ClimAnnonce; price: number } => x.price != null && x.price >= 400)
    .sort((x, y) => x.price - y.price);
  for (const { a, price } of candidates) {
    const key = `${a.shop}:${a.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ shop: a.shop, title: a.title, brand: a.brand, btu: a.btu, tech: a.tech, price, url: a.url });
    if (out.length >= limit) break;
  }
  return out;
}

function shopCheapestFrom(file: ClimStockFile, shop: string): ClimOffer | null {
  let best: ClimOffer | null = null;
  for (const a of file.annonces) {
    if (a.shop !== shop || a.btu == null) continue;
    const price = normalizedPrice(a);
    if (price == null || price < 400) continue;
    if (!best || price < best.price) {
      best = { shop: a.shop, title: a.title, brand: a.brand, btu: a.btu, tech: a.tech, price, url: a.url };
    }
  }
  return best;
}

function offersByBrandFrom(file: ClimStockFile, brand: string): ClimOffer[] {
  const key = brand.toLowerCase();
  const candidates = file.annonces
    .filter((a) => a.brand?.toLowerCase() === key)
    .map((a) => ({ a, price: normalizedPrice(a) }))
    .filter((x): x is { a: ClimAnnonce; price: number } => x.price != null && x.price >= 400)
    .sort((x, y) => x.price - y.price);
  return dedupeOffers(candidates);
}

function brandDetailFrom(file: ClimStockFile, brand: string): ClimBrandDetail | null {
  const offers = offersByBrandFrom(file, brand);
  if (!offers.length) return null;

  const btuMap = new Map<string, { count: number; minPrice: number }>();
  const shopMap = new Map<string, { count: number; minPrice: number }>();

  for (const o of offers) {
    if (o.btu) {
      const cur = btuMap.get(o.btu);
      if (!cur) btuMap.set(o.btu, { count: 1, minPrice: o.price });
      else btuMap.set(o.btu, { count: cur.count + 1, minPrice: Math.min(cur.minPrice, o.price) });
    }
    const sc = shopMap.get(o.shop);
    if (!sc) shopMap.set(o.shop, { count: 1, minPrice: o.price });
    else shopMap.set(o.shop, { count: sc.count + 1, minPrice: Math.min(sc.minPrice, o.price) });
  }

  return {
    brand,
    label: climBrandLabel(brand),
    logo: climBrandLogo(brand),
    count: offers.length,
    shopCount: shopMap.size,
    minPrice: offers[0]?.price ?? null,
    maxPrice: offers[offers.length - 1]?.price ?? null,
    byBtu: [...btuMap.entries()]
      .map(([btu, v]) => ({ btu, ...v }))
      .sort((a, b) => Number(a.btu) - Number(b.btu)),
    byShop: [...shopMap.entries()]
      .map(([shop, v]) => ({ shop, ...v }))
      .sort((a, b) => b.count - a.count),
    offers,
  };
}

/** Async API: DB first, JSON fallback. */
export async function getClimStatsAsync() {
  const file = await resolveClimStockFile();
  const brandTotals = brandTotalsFrom(file);
  const brandBySlug = new Map(brandTotals.map((b) => [climBrandSlug(b.brand), b.brand]));
  return {
    file,
    generatedAt: file.generated_at,
    totals: file.totaux,
    btuTiers: btuTiersFrom(file),
    shops: shopsFrom(file),
    brandTotals,
    brandFromSlug: (slug: string) => brandBySlug.get(slug.toLowerCase()) ?? null,
    brandSlugs: [...brandBySlug.keys()],
    btuComparison: (btu: string) => btuComparisonFrom(file, btu),
    btuComparisonWithUrls: (btu: string) => btuComparisonWithUrlsFrom(file, btu),
    cheapestOffers: (limit?: number, btu?: string) => cheapestOffersFrom(file, limit, btu),
    shopCheapest: (shop: string) => shopCheapestFrom(file, shop),
    brandDetail: (brand: string) => brandDetailFrom(file, brand),
    shopName: climShopName,
    brandLabel: climBrandLabel,
    brandLogo: climBrandLogo,
    brandHref: climBrandHref,
    formatDT,
  };
}

export const climGeneratedAt = data.generated_at;
export const climTotals = data.totaux;

/** BTU tiers, ascending, as present in the snapshot. */
export const climBtuTiers = btuTiersFrom(data);

/** Shops ranked by prix_min for a BTU tier (pre-sorted in the snapshot). */
export function climBtuComparison(btu: string): ClimBtuRow[] {
  return btuComparisonFrom(data, btu);
}

/** Cheapest listing URL for a shop at a given BTU tier (matches prix_min + brand hint). */
export function climBtuRowOffer(btu: string, row: ClimBtuRow): Pick<ClimOffer, "url" | "title"> | null {
  return btuRowOfferFrom(data, btu, row);
}

export function climBtuComparisonWithUrls(btu: string): ClimBtuRowWithUrl[] {
  return btuComparisonWithUrlsFrom(data, btu);
}

/** Per-shop stock, biggest catalog first. */
export const climShops: ClimShopStock[] = shopsFrom(data);

/** Brand → total units in stock across all shops, descending. */
export const climBrandTotals: { brand: string; count: number }[] = brandTotalsFrom(data);

const BRAND_BY_SLUG = new Map(
  climBrandTotals.map((b) => [climBrandSlug(b.brand), b.brand]),
);

// Some shops list prices in thousands (e.g. qsnet "1.229" = 1 229 DT). A real
// climatiseur never costs under 100 DT, so scale those up. Items without a BTU
// (chauffages, chauffe-bains caught by the scraper) are excluded from
// "cheapest" lists entirely.
function normalizedPrice(a: ClimAnnonce): number | null {
  if (a.price == null || !Number.isFinite(a.price)) return null;
  if (a.price < 100) return Math.round(a.price * 1000);
  return a.price;
}

/** Cheapest real climatiseurs (BTU known), across all shops. */
export function climCheapestOffers(limit = 12, btu?: string): ClimOffer[] {
  return cheapestOffersFrom(data, limit, btu);
}

/** Cheapest real climatiseur for one shop (normalized price, BTU required). */
export function climShopCheapest(shop: string): ClimOffer | null {
  return shopCheapestFrom(data, shop);
}

/* ── Brand routing & filtering ───────────────────────────────────────────── */

export function climBrandFromSlug(slug: string): string | null {
  return BRAND_BY_SLUG.get(slug.toLowerCase()) ?? null;
}

export const climBrandSlugs = [...BRAND_BY_SLUG.keys()];

export type ClimBrandDetail = {
  brand: string;
  label: string;
  logo: string | null;
  count: number;
  shopCount: number;
  minPrice: number | null;
  maxPrice: number | null;
  byBtu: { btu: string; count: number; minPrice: number }[];
  byShop: { shop: string; count: number; minPrice: number }[];
  offers: ClimOffer[];
};

function dedupeOffers(candidates: { a: ClimAnnonce; price: number }[]): ClimOffer[] {
  const seen = new Set<string>();
  const out: ClimOffer[] = [];
  for (const { a, price } of candidates) {
    const key = `${a.shop}:${a.url || a.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      shop: a.shop,
      title: a.title,
      brand: a.brand,
      btu: a.btu,
      tech: a.tech,
      price,
      url: a.url,
    });
  }
  return out;
}

/** All in-stock climatiseurs for one brand, cheapest first. */
export function climOffersByBrand(brand: string): ClimOffer[] {
  return offersByBrandFrom(data, brand);
}

export function climBrandDetail(brand: string): ClimBrandDetail | null {
  return brandDetailFrom(data, brand);
}
