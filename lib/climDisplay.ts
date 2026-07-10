/** Client-safe clim display helpers and types (no DB / JSON imports). */

export type ClimOffer = {
  shop: string;
  title: string;
  brand: string | null;
  btu: string | null;
  tech: string | null;
  price: number;
  url: string;
};

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

export function climShopName(key: string): string {
  return SHOP_NAMES[key] ?? key.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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
