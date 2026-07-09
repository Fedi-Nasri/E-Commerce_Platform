#!/usr/bin/env node
/**
 * Transform my_run_117/product_clusters.json → retail matched.jsonl
 *
 * - Keeps only members whose shop is in the 55 existing retail_db shops.
 * - Keeps only clusters that still have >= 2 distinct retail shops (matched).
 * - Normalizes the messy canonical_top_category → canonical retail slug via
 *   keyword rules; unknown labels fall back to "non-categorise".
 * - Emits one JSONL line per cluster in the shape import-retail-dedup.mjs wants:
 *     { name, reference, brand, category, category_slug, offers:[{shop,price,old_price,source_url,sku}] }
 *
 * Usage:
 *   node scripts/transform-clusters-to-retail.mjs <clusters.json> <out.jsonl> [--report]
 */
import { createWriteStream, readFileSync } from "node:fs";

const [inPath, outPath, ...flags] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error("Usage: node transform-clusters-to-retail.mjs <clusters.json> <out.jsonl> [--report]");
  process.exit(1);
}
const REPORT = flags.includes("--report");

const RETAIL_SHOPS = new Set(
  ("spacenet mytek tunisianet gamershop technopro tunewtec carthagoinformatique affariyet wiki jumbo " +
   "bestbuytunisie bill electrohadjkacem zoom alarabia kamounhome sangour yatoo mbm darty infotec jmb " +
   "maalejaudio techgate krichen tokyo_store dokani try_and_buy batam agora bstech qsnet koktahome sbs " +
   "allani emh chaktech informatica itechstore acspace taktek electrochaabani expert_gaming psstore scoop " +
   "graiet techland electrobennjima skymill imag megapc topbureau sigshop ispace benzarti-electromenager")
    .split(/\s+/),
);

function norm(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/chevron_right|promo\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Ordered keyword rules → canonical slug. First match wins, so put the most
// specific rules first (e.g. "pc portable gamer" before "pc portable").
const RULES = [
  [/\biphone\b/, "smartphones"],
  [/airpods?|airpuds/, "casques-et-ecouteurs"],
  [/\bmac\b|macbook|imac/, "ordinateurs-apple"],
  [/recepteur numerique|box tv|decodeur/, "home-cinema-et-streaming"],
  [/cles? usb|disque interne|disque externe/, "stockage"],
  [/friteuse|air ?fryer/, "petit-electromenager"],
  [/climatisation/, "climatiseurs"],
  [/pc portable gamer|portable gamer|laptop gamer/, "pc-portables-gamer"],
  [/pc (de )?bureau gamer|desktop gamer/, "pc-de-bureau-gamer"],
  [/pc gamer|gaming.*(pc|config)/, "pc-de-bureau-gamer"],
  [/pc portable|laptop|ordinateur portable|notebook/, "pc-portables"],
  [/pc (de )?bureau|ordinateur (de )?bureau|desktop|unite centrale/, "pc-de-bureau"],
  [/apple|imac|macbook|mac /, "ordinateurs-apple"],
  [/smartphone|mobile|gsm|telephone portable/, "smartphones"],
  [/telephone classique|telephone fixe|feature phone/, "telephones-classiques"],
  [/tablette|tablet|ipad/, "tablettes"],
  [/smart ?watch|montre connectee|objet connecte|wearable/, "montres-et-objets-connectes"],
  [/montre|bijou|watch/, "montres-et-bijoux"],
  [/accessoire.*(telephon|mobile)|telephonie.*accessoire/, "accessoires-telephonie"],
  [/telephonie|telephone/, "smartphones"],
  [/carte graphique|gpu|processeur|cpu|carte mere|motherboard|ram|memoire|barrette|composant/, "composants"],
  [/stockage|ssd|hdd|disque dur|nvme|carte (memoire|sd)|cle usb|flash/, "stockage"],
  [/accessoire.*(pc|ordinateur|informatique)|peripherique/, "accessoires-informatiques"],
  [/reseau|network|securite|surveillance|camera ip|routeur|switch|serveur|capteur/, "reseaux-serveurs-et-securite"],
  [/ecran|moniteur|monitor/, "ecrans-et-moniteurs"],
  [/imprimante|scanner|impression/, "imprimantes-et-scanners"],
  [/encre|toner|cartouche|consommable/, "encre-et-toner"],
  [/onduleur|alimentation|ups|batterie|chargeur/, "onduleurs-et-alimentation"],
  [/logiciel|software|licence/, "logiciels"],
  [/point de vente|caisse|pos /, "materiel-point-de-vente"],
  [/gaming|manette|controller/, "accessoires-gamer"],
  [/console|playstation|xbox|nintendo/, "consoles"],
  [/jeu video|jeux video|game/, "jeux-video"],
  [/casque|ecouteur|headphone|earphone/, "casques-et-ecouteurs"],
  [/enceinte|haut.?parleur|speaker|barre de son|soundbar/, "enceintes-et-haut-parleurs"],
  [/micro\b|microphone/, "microphones"],
  [/home cinema|cinema|streaming/, "home-cinema-et-streaming"],
  [/televiseur|television|\btv\b|smart tv/, "televisions"],
  [/appareil photo|camera|photo|objectif/, "appareils-photo"],
  [/videoprojecteur|projecteur|projection/, "videoprojecteurs"],
  [/image (et |& )?son|audio|hifi|son numerique/, "audio-general"],
  [/climatiseur|clim\b|split/, "climatiseurs"],
  [/chauffage|chauffe.?eau|radiateur/, "chauffage"],
  [/ventilat|traitement d air|purificateur/, "ventilation-et-traitement-d-air"],
  [/refriger|frigo|congelateur|froid/, "froid-et-refrigeration"],
  [/lave.?linge|machine a laver|lavage|seche.?linge/, "lavage"],
  [/aspirateur|nettoyage|nettoyeur/, "aspirateurs-et-nettoyage"],
  [/cuisson|four|micro.?onde|plaque|table de cuisson|cuisiniere|gaziniere/, "cuisson"],
  [/petit electro|preparation culinaire|petits? appareils?|blender|mixeur|robot|cafe|petit dejeuner|bouilloire|grille pain/, "petit-electromenager"],
  [/gros electro|gros electromenager/, "gros-electromenager"],
  [/electromenager|electro menager/, "gros-electromenager"],
  [/ustensile|vaisselle|art de la table|cuisine/, "cuisine-et-vaisselle"],
  [/meuble.*bureau|mobilier.*bureau/, "meubles-de-bureau"],
  [/chaise|fauteuil|salon|meuble|table\b|mobilier/, "meubles"],
  [/linge de maison|linge/, "accessoires-maison-et-decoration"],
  [/decoration|luminaire|eclairage|lampe/, "eclairage-et-electricite"],
  [/bricolage|outil|quincaillerie|perceuse|visseuse/, "outils-et-quincaillerie"],
  [/jardin|exterieur/, "jardin-et-exterieur"],
  [/piscine/, "piscines"],
  [/salle de bain|plomberie|sanitaire/, "salle-de-bain-et-plomberie"],
  [/bureautique|fourniture.*bureau|classement|archivage|papeterie|papier\b/, "fournitures-de-bureau"],
  [/scolaire|article scolaire/, "fournitures-scolaires"],
  [/livre|book|edition/, "livres"],
  [/moto|scooter/, "moto-et-scooter"],
  [/velo|trottinette|mobilite/, "velos-et-mobilite-urbaine"],
  [/pneu\b/, "pneus"],
  [/auto\b|voiture|automobile/, "accessoires-auto"],
  [/fitness|musculation|electrostimulation/, "fitness-et-musculation"],
  [/sport|loisir/, "equipement-sport"],
  [/jouet|jeu\b|jeux\b/, "jouets-et-jeux"],
  [/medical|orthopedie|tensiometre/, "medical-et-orthopedie"],
  [/meilleures? ventes|nos marques|decouvrez/, "meilleures-ventes"],
  [/promo|offre/, "promotions-et-offres"],
  // ── Catch-alls (run last) ──
  [/cable|connectique|adaptateur|clavier|souris|carte de developpement|\bcnc\b|arduino|raspberry/, "accessoires-informatiques"],
  [/radio reveil|station meteo|reveil/, "petit-electromenager"],
  [/encastrable/, "gros-electromenager"],
  [/materiel informatique|informatique|bureautique/, "accessoires-informatiques"],
  [/maison|brico|animalerie/, "accessoires-maison-et-decoration"],
  [/bicyclette/, "velos-et-mobilite-urbaine"],
];

function mapCategory(raw) {
  const n = norm(raw);
  if (!n) return "non-categorise";
  for (const [re, slug] of RULES) if (re.test(n)) return slug;
  return "non-categorise";
}

// ── Run ──
const clusters = JSON.parse(readFileSync(inPath, "utf-8"));
const out = createWriteStream(outPath, { encoding: "utf-8" });

let kept = 0, dropped = 0, offersOut = 0;
const catCounts = {};
const unmapped = {};

for (const c of clusters) {
  const members = (c.members || []).filter((m) => RETAIL_SHOPS.has(m.shop));
  const shops = new Set(members.map((m) => m.shop));
  if (shops.size < 2) { dropped++; continue; }

  // one offer per shop — cheapest wins if a shop has several members
  const bestByShop = new Map();
  for (const m of members) {
    const price = typeof m.price === "number" && m.price > 0 ? m.price : null;
    const prev = bestByShop.get(m.shop);
    if (!prev || (price != null && (prev.price == null || price < prev.price))) {
      bestByShop.set(m.shop, { shop: m.shop, price, source_url: m.url || "", sku: m.sku || null });
    }
  }
  const offers = [...bestByShop.values()].map((o) => ({
    shop: o.shop, price: o.price, old_price: null, source_url: o.source_url, sku: o.sku,
  }));
  if (offers.length < 2) { dropped++; continue; }

  const catSlug = mapCategory(c.canonical_top_category);
  catCounts[catSlug] = (catCounts[catSlug] || 0) + 1;
  if (catSlug === "non-categorise") {
    const key = c.canonical_top_category || "None";
    unmapped[key] = (unmapped[key] || 0) + 1;
  }

  out.write(JSON.stringify({
    name: c.canonical_title,
    reference: c.cluster_id,
    brand: c.canonical_brand && c.canonical_brand !== "sans fabricant" ? c.canonical_brand : null,
    category: c.canonical_top_category || "Non catégorisé",
    category_slug: catSlug,
    offers,
  }) + "\n");
  kept++;
  offersOut += offers.length;
}

out.end();

console.log(`✓ Kept ${kept} clusters, dropped ${dropped}, wrote ${offersOut} offers → ${outPath}`);
console.log(`\nCategory distribution (mapped slug):`);
for (const [slug, n] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(6)}  ${slug}`);
}
if (REPORT) {
  const uEntries = Object.entries(unmapped).sort((a, b) => b[1] - a[1]);
  const uTotal = uEntries.reduce((a, [, n]) => a + n, 0);
  console.log(`\nUnmapped → non-categorise: ${uTotal} clusters across ${uEntries.length} labels. Top 40:`);
  for (const [label, n] of uEntries.slice(0, 40)) console.log(`  ${String(n).padStart(5)}  ${label}`);
}
