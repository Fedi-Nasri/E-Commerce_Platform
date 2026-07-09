// Static map of slug/key -> public path for shop logos available in /public/shop-logos.
// Keep this in sync with the files committed in public/shop-logos.
// Used as a fallback when shops.logo_url is NULL in the DB.

const FILES: Record<string, string> = {
  acspace: "/shop-logos/acspace.webp",
  affariyet: "/shop-logos/affariyet.webp",
  agora: "/shop-logos/agora.png",
  allani: "/shop-logos/allani.jpg",
  batam: "/shop-logos/batam.svg",
  beautystore: "/shop-logos/beautystore.jpg",
  "benzarti-electromenager": "/shop-logos/benzarti-electromenager.png",
  bestbuytunisie: "/shop-logos/bestbuytunisie.png",
  bill: "/shop-logos/bill.svg",
  bstech: "/shop-logos/bstech.webp",
  carrefour: "/shop-logos/carrefour.png",
  carthagoinformatique: "/shop-logos/carthagoinformatique.png",
  chaktech: "/shop-logos/chaktech.png",
  darty: "/shop-logos/darty.jpg",
  dokani: "/shop-logos/dokani.png",
  drest: "/shop-logos/drest.png",
  el_farabi: "/shop-logos/el_farabi.jpg",
  electrobennjima: "/shop-logos/electrobennjima.png",
  electrochaabani: "/shop-logos/electrochaabani.png",
  electrohadjkacem: "/shop-logos/electrohadjkacem.svg",
  emh: "/shop-logos/emh.png",
  expert_gaming: "/shop-logos/expert_gaming.png",
  gamershop: "/shop-logos/gamershop.png",
  geant: "/shop-logos/geant.png",
  graiet: "/shop-logos/graiet.png",
  ikitchen: "/shop-logos/ikitchen.png",
  imag: "/shop-logos/imag.png",
  infotec: "/shop-logos/infotec.png",
  informatica: "/shop-logos/informatica.png",
  ispace: "/shop-logos/ispace.png",
  itechstore: "/shop-logos/itechstore.jpg",
  jmb: "/shop-logos/jmb.png",
  jumbo: "/shop-logos/jumbo.jpg",
  kamounhome: "/shop-logos/kamounhome.png",
  koktahome: "/shop-logos/koktahome.png",
  krichen: "/shop-logos/krichen.png",
  lamode: "/shop-logos/lamode.png",
  maalejaudio: "/shop-logos/maalejaudio.png",
  mageekstore: "/shop-logos/mageekstore.jpg",
  mapara: "/shop-logos/mapara.png",
  mbm: "/shop-logos/mbm.jpg",
  megapc: "/shop-logos/megapc.png",
  mytek: "/shop-logos/mytek.png",
  parafendri: "/shop-logos/parafendri.png",
  parashop: "/shop-logos/parashop.webp",
  pharmacieplus: "/shop-logos/pharmacieplus.png",
  pharmashop: "/shop-logos/pharmashop.png",
  promouv: "/shop-logos/promouv.jpg",
  psstore: "/shop-logos/psstore.png",
  qsnet: "/shop-logos/qsnet.webp",
  sbs: "/shop-logos/sbs.png",
  scoop: "/shop-logos/scoop.png",
  sigshop: "/shop-logos/sigshop.png",
  skymill: "/shop-logos/skymill.png",
  spacenet: "/shop-logos/spacenet.svg",
  taktek: "/shop-logos/taktek.jpg",
  tdiscount: "/shop-logos/tdiscount.png",
  techgate: "/shop-logos/techgate.png",
  techland: "/shop-logos/techland.png",
  technopro: "/shop-logos/technopro.jpg",
  tokyo_store: "/shop-logos/tokyo_store.png",
  topbureau: "/shop-logos/topbureau.jpg",
  try_and_buy: "/shop-logos/try_and_buy.png",
  tunewtec: "/shop-logos/tunewtec.webp",
  tunisianet: "/shop-logos/tunisianet.jpg",
  wiki: "/shop-logos/wiki.png",
  yatoo: "/shop-logos/yatoo.jpg",
  zoom: "/shop-logos/zoom.jpg",
};

// Aliases for variant keys that point to the same logo file.
const ALIASES: Record<string, string> = {
  scoopgaming: "scoop",
  scoop_gaming: "scoop",
  pharma_shop: "pharmashop",
  "pharma-shop": "pharmashop",
  cosmetique: "beautystore", // fallback approximation if needed
  parahouse: "mapara",        // fallback
  paraexpert: "mapara",       // fallback
  wikitn: "wiki",
  "wiki-tn": "wiki",
};

function normalize(k: string): string {
  return k.trim().toLowerCase().replace(/[\s.]+/g, "_").replace(/-+/g, "-");
}

export function localShopLogo(slug: string | null | undefined, key?: string | null): string | null {
  const candidates: string[] = [];
  if (slug) candidates.push(normalize(slug));
  if (key) candidates.push(normalize(key));

  for (const c of candidates) {
    if (FILES[c]) return FILES[c];
    if (ALIASES[c] && FILES[ALIASES[c]]) return FILES[ALIASES[c]];
    // try with underscores swapped for hyphens
    const alt = c.replace(/_/g, "-");
    if (FILES[alt]) return FILES[alt];
    const alt2 = c.replace(/-/g, "_");
    if (FILES[alt2]) return FILES[alt2];
  }
  return null;
}
