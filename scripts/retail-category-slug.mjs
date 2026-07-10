/** Shared retail category slug mapping (same rules as transform-clusters-to-retail.mjs). */

function norm(s) {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/chevron_right|promo\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

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
  [/carte graphique|gpu|processeur|cpu|carte mere|motherboard|ram|memoire|barrette|composant/, "composants"],
  [/stockage|ssd|hdd|disque dur|nvme|carte (memoire|sd)|cle usb|flash/, "stockage"],
  [/accessoire.*(pc|ordinateur|informatique)|peripherique/, "accessoires-informatiques"],
  [/reseau|network|securite|surveillance|camera ip|routeur|switch|serveur|capteur/, "reseaux-serveurs-et-securite"],
  [/ecran|moniteur|monitor/, "ecrans-et-moniteurs"],
  [/imprimante|scanner|impression/, "imprimantes-et-scanners"],
  [/televiseur|television|\btv\b|smart tv/, "televisions"],
  [/climatiseur|clim\b|split/, "climatiseurs"],
  [/electromenager|electro menager/, "gros-electromenager"],
  [/cable|connectique|adaptateur|clavier|souris/, "accessoires-informatiques"],
  [/informatique|bureautique/, "accessoires-informatiques"],
];

const LABELS = {
  smartphones: "Smartphones",
  "pc-portables": "PC portables",
  "pc-de-bureau": "PC de bureau",
  "pc-portables-gamer": "PC portables gamer",
  "pc-de-bureau-gamer": "PC de bureau gamer",
  "ordinateurs-apple": "Ordinateurs Apple",
  televisions: "Télévisions",
  climatiseurs: "Climatiseurs",
  stockage: "Stockage",
  composants: "Composants",
  "accessoires-informatiques": "Accessoires informatiques",
  "reseaux-serveurs-et-securite": "Réseaux & sécurité",
  "ecrans-et-moniteurs": "Écrans & moniteurs",
  "casques-et-ecouteurs": "Casques & écouteurs",
  "gros-electromenager": "Gros électroménager",
  "petit-electromenager": "Petit électroménager",
  "non-categorise": "Non catégorisé",
};

export function mapCategory(raw) {
  const n = norm(raw);
  if (!n) return "non-categorise";
  for (const [re, slug] of RULES) if (re.test(n)) return slug;
  return "non-categorise";
}

export function slugToLabel(slug) {
  if (LABELS[slug]) return LABELS[slug];
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
