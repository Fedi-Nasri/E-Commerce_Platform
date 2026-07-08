import raw from "@/lib/data/climatiseursEnStock.json";

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

// Brand → official domain, used to fetch a small logo via the Google favicon
// service (same pattern as RetailSitesTable). Unknown brands fall back to a
// letter tile in the UI.
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
  tornado: "tornado.com.eg",
  fresh: "fresh.com.eg",
  unionaire: "unionaire.com",
  saba: "saba.tn",
  biolux: "biolux.tn",
};

export function climBrandLogo(brand: string): string | null {
  const domain = BRAND_DOMAINS[brand.toLowerCase()];
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;
}

export function climBrandLabel(brand: string): string {
  if (brand.length <= 3) return brand.toUpperCase();
  return brand.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDT(n: number): string {
  return `${n.toLocaleString("fr-FR")} DT`;
}
