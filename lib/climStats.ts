import raw from "@/lib/data/climatiseursEnStock.json";
import { climBrandHref, climBrandSlug } from "@/lib/climBrandUtils";

export { climBrandHref, climBrandSlug };

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

export const climGeneratedAt = data.generated_at;
export const climTotals = data.totaux;

/** BTU tiers, ascending, as present in the snapshot. */
export const climBtuTiers = Object.keys(data.comparaison_globale_par_btu).sort(
  (a, b) => Number(a) - Number(b),
);

/** Shops ranked by prix_min for a BTU tier (pre-sorted in the snapshot). */
export function climBtuComparison(btu: string): ClimBtuRow[] {
  return data.comparaison_globale_par_btu[btu] ?? [];
}

/** Cheapest listing URL for a shop at a given BTU tier (matches prix_min + brand hint). */
export function climBtuRowOffer(btu: string, row: ClimBtuRow): Pick<ClimOffer, "url" | "title"> | null {
  const brands = new Set(row.marques_au_prix_min.map((b) => b.toLowerCase()));
  const target = Math.round(row.prix_min);
  let best: ClimAnnonce | null = null;
  let bestPrice = Infinity;

  const consider = (a: ClimAnnonce, requireBrand: boolean) => {
    if (a.shop !== row.shop || a.btu !== btu || !a.url) return;
    const price = normalizedPrice(a);
    if (price == null || Math.round(price) !== target) return;
    if (requireBrand && brands.size && a.brand && !brands.has(a.brand.toLowerCase())) return;
    if (price < bestPrice) {
      best = a;
      bestPrice = price;
    }
  };

  for (const a of data.annonces) consider(a, true);
  if (!best) for (const a of data.annonces) consider(a, false);
  if (!best) return null;
  return { url: best.url, title: best.title };
}

export function climBtuComparisonWithUrls(btu: string): ClimBtuRowWithUrl[] {
  return climBtuComparison(btu).map((row) => {
    const offer = climBtuRowOffer(btu, row);
    return { ...row, url: offer?.url ?? null, title: offer?.title ?? null };
  });
}

/** Per-shop stock, biggest catalog first. */
export const climShops: ClimShopStock[] = [...data.par_boutique].sort(
  (a, b) => b.total_climatiseurs - a.total_climatiseurs,
);

/** Brand → total units in stock across all shops, descending. */
export const climBrandTotals: { brand: string; count: number }[] = (() => {
  const acc = new Map<string, number>();
  for (const s of data.par_boutique) {
    for (const [brand, n] of Object.entries(s.marques)) {
      acc.set(brand, (acc.get(brand) ?? 0) + n);
    }
  }
  return [...acc.entries()]
    .map(([brand, count]) => ({ brand, count }))
    .sort((a, b) => b.count - a.count);
})();

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

export type ClimOffer = {
  shop: string;
  title: string;
  brand: string | null;
  btu: string | null;
  tech: string | null;
  price: number;
  url: string;
};

/** Cheapest real climatiseurs (BTU known), across all shops. */
export function climCheapestOffers(limit = 12, btu?: string): ClimOffer[] {
  const seen = new Set<string>();
  const out: ClimOffer[] = [];
  const candidates = data.annonces
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

/** Cheapest real climatiseur for one shop (normalized price, BTU required). */
export function climShopCheapest(shop: string): ClimOffer | null {
  let best: ClimOffer | null = null;
  for (const a of data.annonces) {
    if (a.shop !== shop || a.btu == null) continue;
    const price = normalizedPrice(a);
    if (price == null || price < 400) continue;
    if (!best || price < best.price) {
      best = { shop: a.shop, title: a.title, brand: a.brand, btu: a.btu, tech: a.tech, price, url: a.url };
    }
  }
  return best;
}

/* ── Display helpers ─────────────────────────────────────────────────────── */

const SHOP_NAMES: Record<string, string> = {
  acspace: "AC Space",
  affariyet: "Affariyet",
  agora: "Agora",
  allani: "Allani",
  batam: "Batam",
  "benzarti-electromenager": "Benzarti",
  bstech: "BSTech",
  carthagoinformatique: "Carthago Informatique",
  chaktech: "ChakTech",
  darty: "Darty",
  electrobennjima: "Electro Ben Njima",
  electrochaabani: "Electro Chaabani",
  electrohadjkacem: "Electro Hadj Kacem",
  emh: "EMH",
  jmb: "JMB",
  kamounhome: "Kamoun Home",
  koktahome: "Kokta Home",
  maalejaudio: "Maalej Audio",
  mytek: "MyTek",
  qsnet: "QSNet",
  spacenet: "SpaceNet",
  techland: "TechLand",
  technopro: "TechnoPro",
  tunisianet: "TunisiaNet",
  wiki: "Wiki.tn",
  yatoo: "Yatoo",
  zoom: "Zoom",
};

export function climShopName(key: string): string {
  return SHOP_NAMES[key] ?? key.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Curated local logos (public/brand-logos) — preferred over remote favicons.
const BRAND_LOGO_FILES: Record<string, string> = {
  biolux: "/brand-logos/biolux.png",
  bosch: "/brand-logos/bosch.png",
  brandt: "/brand-logos/brandt.webp",
  coala: "/brand-logos/coala.png",
  comfee: "/brand-logos/comfee.png",
  condor: "/brand-logos/condor.jpg",
  cristor: "/brand-logos/cristor.png",
  falcon: "/brand-logos/falcon.png",
  focus: "/brand-logos/focus.webp",
  fresh: "/brand-logos/fresh.png",
  gree: "/brand-logos/gree.webp",
  hisense: "/brand-logos/hisense.webp",
  hyundai: "/brand-logos/hyundai.png",
  indesit: "/brand-logos/indesit.png",
  iris: "/brand-logos/iris.png",
  lg: "/brand-logos/lg.webp",
  maxwell: "/brand-logos/maxwell.png",
  midea: "/brand-logos/midea.png",
  orient: "/brand-logos/orient.png",
  saba: "/brand-logos/saba.jpg",
  samsung: "/brand-logos/samsung.webp",
  sharp: "/brand-logos/sharp.webp",
  tcl: "/brand-logos/tcl.webp",
  tornado: "/brand-logos/tornado.png",
  unionaire: "/brand-logos/unionaire.png",
  vega: "/brand-logos/vega.png",
  westpoint: "/brand-logos/westpoint.png",
};

// Fallback: official domain → Google favicon for brands without a local asset.
const BRAND_DOMAINS: Record<string, string> = {
  gree: "gree.com",
  lg: "lg.com",
  samsung: "samsung.com",
  tcl: "tcl.com",
  midea: "midea.com",
  bosch: "bosch-home.com",
  hisense: "hisense.com",
  sharp: "global.sharp",
  hyundai: "hyundai.com",
  condor: "condor.dz",
  brandt: "brandt.com",
  indesit: "indesit.com",
  comfee: "comfee.com",
  tornado: "tornado.com",
  fresh: "fresh.com.eg",
  unionaire: "unionaire.com",
  saba: "saba.tn",
  biolux: "biolux.tn",
  coala: "coala-tunisie.com",
  focus: "focus.tn",
  westpoint: "westpoint.tn",
  iris: "iris.tn",
  cristor: "cristor.com",
  vega: "vega.tn",
  orient: "orient.tn",
  maxwell: "maxwell.com",
  falcon: "falcon.com",
  emtop: "emtop.tn",
  newstar: "newstar.tn",
  starone: "starone.tn",
  "star one": "starone.tn",
};

export function climBrandLogo(brand: string): string | null {
  const key = brand.toLowerCase();
  const local = BRAND_LOGO_FILES[key];
  if (local) return local;
  const domain = BRAND_DOMAINS[key];
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;
}

export function climBrandLabel(brand: string): string {
  if (brand.length <= 3) return brand.toUpperCase();
  return brand.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDT(n: number): string {
  return `${n.toLocaleString("fr-FR")} DT`;
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
  const key = brand.toLowerCase();
  const candidates = data.annonces
    .filter((a) => a.brand?.toLowerCase() === key)
    .map((a) => ({ a, price: normalizedPrice(a) }))
    .filter((x): x is { a: ClimAnnonce; price: number } => x.price != null && x.price >= 400)
    .sort((x, y) => x.price - y.price);
  return dedupeOffers(candidates);
}

export function climBrandDetail(brand: string): ClimBrandDetail | null {
  const offers = climOffersByBrand(brand);
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
