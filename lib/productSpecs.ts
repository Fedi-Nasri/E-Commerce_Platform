/**
 * Extraction EXHAUSTIVE d'attributs techniques + logique de compatibilité.
 * Couvre : informatique, électroménager, téléphonie, TV/audio, gaming,
 * énergie, mobilité électrique.
 *
 * Deux usages :
 *  1. extractSpecs(nom) → dict des specs détectées
 *  2. Mode "catalogue" : filtrer les produits selon les specs de la REQUÊTE
 *     (si l'user tape "12000 BTU", on garde tous les 12000 BTU, toutes marques)
 */

function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export type Specs = Record<string, string | number>;

const RAM_SET = new Set([1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 256]);
const STOCK_SET = new Set([120, 128, 240, 250, 256, 480, 500, 512, 1000, 2000, 4000]);

export function extractSpecs(name: string): Specs {
  const n = norm(name);
  const specs: Specs = {};

  const isPhone = /iphone|smartphone|galaxy|redmi|\bnote\s*\d|honor|oppo|realme|\btel(ephone)?\b/.test(n);

  // ═══════════════ INFORMATIQUE / MÉMOIRE ═══════════════
  const goValues = [...n.matchAll(/(\d{1,4})\s*g[o|b]\b/g)].map((m) => parseInt(m[1]));
  const toValues = [...n.matchAll(/(\d{1,2})\s*t[o|b]\b/g)].map((m) => parseInt(m[1]));
  if (isPhone) {
    // Sur un téléphone : les grandes valeurs = stockage, les petites (<=16) = RAM
    const stock = goValues.filter((v) => v >= 32);
    const ram = goValues.filter((v) => v <= 16);
    if (stock.length) specs.stockage_go = Math.max(...stock);
    if (ram.length) specs.ram_go = Math.max(...ram);
  } else {
    const ramC = goValues.filter((v) => RAM_SET.has(v) && v <= 256);
    const stockC = goValues.filter((v) => STOCK_SET.has(v)).concat(toValues.map((v) => v * 1024));
    if (ramC.length) specs.ram_go = Math.max(...ramC);
    if (stockC.length) specs.stockage_go = Math.max(...stockC);
  }
  for (const st of ["nvme", "ssd", "hdd", "emmc", "sata"]) if (n.includes(st)) { specs.type_stockage = st; break; }
  const ddr = n.match(/\b(l?pddr\d|ddr\d)\b/);
  if (ddr) specs.type_ram = ddr[1];

  // CPU
  const cpu = n.match(/\b(i[3579]|ryzen\s*[3579]|celeron|pentium|athlon|ultra\s*[3579]|snapdragon|dimensity|mediatek|helio|exynos|apple\s*m[1234]|\bm[1234]\b|core\s*[3579])\b/);
  if (cpu) specs.cpu_famille = cpu[1].replace(/\s+/g, "");
  const cpuModel = n.match(/\b([nirm]\d{2,5}[a-z]{0,3}|\d{4,5}[a-z]{1,3})\b/);
  if (cpuModel) specs.cpu_model = cpuModel[1];
  const gen = n.match(/\b(\d{1,2})\s*(?:eme|e|th|nd|rd|st)?\s*(?:gen|generation|gén)\b/);
  if (gen) specs.cpu_gen = parseInt(gen[1]);

  // GPU + VRAM
  const gpu = n.match(/\b(rtx|gtx|rx|arc)\s*(\d{3,4})\s*(ti|xt|super)?\b/);
  if (gpu) specs.gpu = `${gpu[1]}${gpu[2]}${gpu[3] || ""}`.trim();
  const vram = n.match(/(\d{1,2})\s*g[o|b]\s*(?:gddr\d|vram)/);
  if (vram) specs.vram_go = parseInt(vram[1]);

  // ═══════════════ BUREAUTIQUE / IMPRESSION ═══════════════
  // Type d'imprimante
  const isPrinter = /imprimante|multifonction|printer/.test(n);
  if (/jet\s*d['e ]?encre|inkjet|jet d'encre/.test(n) || (isPrinter && /\bjet\b/.test(n))) specs.imprimante_tech = "jetdencre";
  else if (/laser/.test(n)) specs.imprimante_tech = "laser";
  else if (/thermique|thermal/.test(n)) specs.imprimante_tech = "thermique";
  else if (/sublimation/.test(n)) specs.imprimante_tech = "sublimation";
  else if (/matricielle|matriciel/.test(n)) specs.imprimante_tech = "matricielle";
  if (/multifonction|tout[- ]en[- ]un|mfp|\b3\s*en\s*1\b|\b4\s*en\s*1\b/.test(n)) specs.imprimante_fonction = "multifonction";
  if (/recto[- ]?verso|duplex/.test(n)) specs.recto_verso = "oui";
  // Couleur vs monochrome
  if (/monochrome|noir\s*et\s*blanc|\bn&b\b|\bnb\b/.test(n)) specs.impression_couleur = "monochrome";
  else if (/couleurs?\b/.test(n) && (n.includes("imprimante") || n.includes("multifonction"))) specs.impression_couleur = "couleur";
  // Format papier
  const format = n.match(/\b(a[0-4]|a3\+|10x15)\b/);
  if (format && (n.includes("imprimante") || n.includes("scanner") || n.includes("papier"))) specs.format_papier = format[1];
  // Résolution d'impression (dpi / ppp)
  const dpi = n.match(/(\d{3,4})\s*(?:x\s*\d{3,4}\s*)?(?:dpi|ppp)\b/);
  if (dpi) specs.dpi = parseInt(dpi[1]);
  // Vitesse ppm (pages/minute)
  const ppm = n.match(/(\d{1,3})\s*(?:ppm|pages?\/min|ipm)\b/);
  if (ppm) specs.ppm = parseInt(ppm[1]);

  // ═══════════════ CONNECTIVITÉ / RÉSEAU ═══════════════
  if (/\bwifi\b|wi-?fi|sans\s*fil/.test(n)) specs.wifi = "oui";
  if (/bluetooth|\bbt\b/.test(n)) specs.bluetooth = "oui";
  if (/\brj45\b|ethernet|gigabit|\blan\b/.test(n)) specs.ethernet = "oui";
  const usbv = n.match(/usb\s*(?:type[- ]?)?(c|3\.[012]|2\.0|4)\b/);
  if (usbv) specs.usb = usbv[1].replace(/\s/g, "");
  if (/\bhdmi\b/.test(n)) specs.hdmi = "oui";
  if (/thunderbolt/.test(n)) specs.thunderbolt = "oui";
  // Débit réseau (routeurs/switch)
  const ports = n.match(/(\d{1,2})\s*ports?\b/);
  if (ports) specs.ports = parseInt(ports[1]);
  const wifiStd = n.match(/wifi\s*(\d)|802\.11\s*([a-z]{1,2})|wi-?fi\s*(\d)/);
  if (wifiStd) specs.wifi_std = (wifiStd[1] || wifiStd[2] || wifiStd[3]);

  // ═══════════════ SCANNER / PROJECTEUR ═══════════════
  if (n.includes("scanner") || n.includes("numériseur")) specs.type_appareil = "scanner";
  const lumens = n.match(/(\d{3,5})\s*(?:lumens?|lm)\b/);
  if (lumens) specs.lumens = parseInt(lumens[1]);

  // ═══════════════ ÉCRAN / TV ═══════════════
  const screen = n.match(/(\d{1,3}(?:[.,]\d)?)\s*(?:"|''|pouces?|'')/);
  if (screen) specs.ecran_pouces = parseFloat(screen[1].replace(",", "."));
  // Résolution. Attention : "8k" ne doit PAS matcher "8kg" (machine à laver).
  // Les résolutions numériques suffixées 'k' exigent une frontière (pas de lettre après).
  const resList: [string, RegExp][] = [
    ["8k", /\b8k\b(?![a-z])/], ["4k", /\b4k\b(?![a-z])/], ["2k", /\b2k\b(?![a-z])/],
    ["uhd", /\buhd\b/], ["qhd", /\bqhd\b/], ["fhd", /\bfhd\b/], ["fullhd", /full\s*hd/],
    ["1080p", /1080p/], ["2160p", /2160p/], ["4320p", /4320p/], ["1440p", /1440p/],
    ["720p", /720p/], ["hdready", /hd\s*ready/],
  ];
  for (const [label, re] of resList) if (re.test(n)) { specs.resolution = label; break; }
  const hz = n.match(/(\d{2,3})\s*hz\b/);
  if (hz) specs.hz = parseInt(hz[1]);
  for (const d of ["mini led", "neo qled", "qled", "oled", "nanocell", "nano", "ips", "amoled", "led"])
    if (n.includes(d)) { specs.dalle = d.trim(); break; }
  if (/\btactile\b|touch\b/.test(n)) specs.tactile = "oui";
  if (/smart\s*tv|android tv|google tv|webos|tizen/.test(n)) specs.smart_tv = "oui";
  // OS
  for (const os of ["windows 11", "windows 10", "windows", "freedos", "dos", "android", "ios", "harmonyos", "chromeos"])
    if (n.includes(os)) { specs.os = os.replace(/\s/g, ""); break; }

  // ═══════════════ CLIMATISATION ═══════════════
  let btu = [...n.matchAll(/(\d{4,5})\s*btu/g)].map((m) => m[1]);
  if (!btu.length && (n.includes("climatiseur") || n.includes("clim ") || n.includes("climat") || n.includes("split")))
    btu = [...n.matchAll(/\b(9000|12000|18000|24000|30000|36000|48000|60000)\b/g)].map((m) => m[1]);
  if (btu.length) specs.btu = parseInt(btu[0]);
  if (n.includes("inverter")) specs.clim_type = "inverter";
  else if (/on\s*[\/-]?\s*off/.test(n)) specs.clim_type = "onoff";
  if (/chaud\s*[\/&et-]*\s*froid|chaud.et.froid|reversible/.test(n)) specs.clim_mode = "chaudfroid";
  else if (/\bfroid\b/.test(n) && !n.includes("chaud")) specs.clim_mode = "froid";

  // ═══════════════ FRIGO / CONGÉLATEUR ═══════════════
  const litres = [...n.matchAll(/(\d{2,4})\s*l(?:itres?)?\b/g)].map((m) => parseInt(m[1])).filter((v) => v >= 30 && v <= 900);
  if (litres.length) specs.litres = Math.max(...litres);
  if (/no\s*frost|nofrost/.test(n)) specs.frigo_tech = "nofrost";
  else if (/statique/.test(n)) specs.frigo_tech = "statique";
  else if (/defrost|de\s*frost|semi\s*no\s*frost/.test(n)) specs.frigo_tech = "defrost";
  if (/side\s*by\s*side/.test(n)) specs.frigo_type = "sidebyside";
  else if (/combine|combiné/.test(n)) specs.frigo_type = "combine";
  else if (/\b1\s*porte|une\s*porte/.test(n)) specs.frigo_type = "1porte";
  else if (/\b2\s*portes?|double\s*porte/.test(n)) specs.frigo_type = "2portes";
  else if (/\bmini\s*bar\b|minibar/.test(n)) specs.frigo_type = "minibar";
  if (/distributeur\s*d['e ]?eau|water\s*dispenser/.test(n)) specs.distributeur_eau = "oui";

  // ═══════════════ CUISSON (four, cuisinière, plaque, micro-ondes) ═══════════════
  const foyers = n.match(/(\d)\s*(?:foyers?|feux|zones?\s*de\s*cuisson|bruleurs?|brûleurs?)\b/);
  if (foyers) specs.foyers = parseInt(foyers[1]);
  if (/induction/.test(n)) specs.cuisson_energie = "induction";
  else if (/vitroc[ée]ramique|vitro/.test(n)) specs.cuisson_energie = "vitroceramique";
  else if (/\bgaz\b/.test(n) && !/r32|r410|r22|r290/.test(n)) specs.cuisson_energie = "gaz";
  else if (/[ée]lectrique/.test(n) && /four|cuisin|plaque/.test(n)) specs.cuisson_energie = "electrique";
  if (/chaleur\s*tournante|convection/.test(n)) specs.chaleur_tournante = "oui";
  if (/pyrolyse/.test(n)) specs.nettoyage_four = "pyrolyse";
  else if (/catalyse/.test(n)) specs.nettoyage_four = "catalyse";
  if (/\bgrill\b/.test(n) && /micro|four/.test(n)) specs.grill = "oui";

  // ═══════════════ MACHINE À LAVER / LAVE-VAISSELLE ═══════════════
  const kg = n.match(/(\d{1,2}(?:[.,]\d)?)\s*kg\b/);
  if (kg) specs.kg = parseFloat(kg[1].replace(",", "."));
  const trs = n.match(/(\d{3,4})\s*(?:tr|trs|tours|rpm)\b/);
  if (trs) specs.essorage_trs = parseInt(trs[1]);
  const couverts = n.match(/(\d{1,2})\s*couverts?\b/);
  if (couverts) specs.couverts = parseInt(couverts[1]);
  const progs = n.match(/(\d{1,2})\s*programmes?\b/);
  if (progs) specs.programmes = parseInt(progs[1]);
  if (/frontale|hublot|chargement\s*frontal/.test(n)) specs.lavage_type = "frontale";
  else if (/top\b|chargement\s*(?:par\s*le\s*)?haut/.test(n) && n.includes("lav")) specs.lavage_type = "top";
  if (/s[ée]chante|lavante[- ]s[ée]chante|s[ée]choir/.test(n)) specs.sechage = "oui";

  // ═══════════════ PUISSANCE (aspirateur, four, micro-ondes, moteur) ═══════════════
  const watts = n.match(/(\d{2,4})\s*w(?:atts?)?\b/);
  if (watts) specs.watts = parseInt(watts[1]);
  // Classe énergétique
  const energ = n.match(/\b(a\+{0,3}|a\s*\+{1,3}|[b-g])\s*(?:\+{0,3})?\b(?=.*(?:energie|energetique|classe))/);
  if (energ) specs.classe_energie = energ[1].replace(/\s/g, "");

  // ═══════════════ TÉLÉPHONIE ═══════════════
  // Modèle iPhone : "iphone 15", "iphone 15 pro max", "iphone 13"
  const iph = n.match(/iphone\s*(\d{1,2})\s*(pro\s*max|pro|plus|mini|se)?/);
  if (iph) specs.modele = `iphone${iph[1]}${iph[2] ? iph[2].replace(/\s/g, "") : ""}`;
  // Modèle Samsung Galaxy : "galaxy a54", "s24 ultra", "note 20"
  const gal = n.match(/\b([as]\d{1,2}|note\s*\d{1,2}|z\s*(?:flip|fold)\s*\d)\s*(ultra|plus|fe|\+)?/);
  if (gal && (n.includes("galaxy") || n.includes("samsung"))) specs.modele = `galaxy${gal[1].replace(/\s/g, "")}${gal[2] || ""}`;
  // Redmi/Note Xiaomi
  const redmi = n.match(/(?:redmi|note)\s*(\d{1,2})\s*(pro|plus|s|c|t)?/);
  if (redmi && /xiaomi|redmi/.test(n)) specs.modele = `redmi${redmi[1]}${redmi[2] || ""}`;

  for (const net of ["5g", "4g", "3g"]) if (new RegExp(`\\b${net}\\b`).test(n)) { specs.reseau = net; break; }
  const mah = n.match(/(\d{3,5})\s*mah\b/);
  if (mah) specs.mah = parseInt(mah[1]);
  const mp = [...n.matchAll(/(\d{1,3})\s*mp\b/g)].map((m) => parseInt(m[1]));
  if (mp.length) specs.camera_mp = Math.max(...mp);
  if (/dual\s*sim|double\s*sim|ds\b/.test(n)) specs.sim = "dualsim";

  // ═══════════════ AUDIO ═══════════════
  const canaux = n.match(/\b(2\.0|2\.1|5\.1|7\.1)\b/);
  if (canaux) specs.canaux = canaux[1];
  if (/bluetooth|sans\s*fil|wireless/.test(n)) specs.audio_connexion = "sansfil";
  else if (/filaire\b/.test(n)) specs.audio_connexion = "filaire";

  // ═══════════════ ÉNERGIE (onduleur, solaire) ═══════════════
  const va = n.match(/(\d{3,5})\s*va\b/);
  if (va) specs.va = parseInt(va[1]);

  // ═══════════════ MOBILITÉ ÉLECTRIQUE ═══════════════
  const kmh = n.match(/(\d{2,3})\s*km\/h\b/);
  if (kmh) specs.vitesse_kmh = parseInt(kmh[1]);
  const autonomie = n.match(/(\d{2,3})\s*km\b(?!\/)/);
  if (autonomie) specs.autonomie_km = parseInt(autonomie[1]);
  const ah = n.match(/(\d{1,3})\s*ah\b/);
  if (ah) specs.ah = parseInt(ah[1]);

  // ═══════════════ MARQUE (pour regroupement) ═══════════════
  const brands = ["samsung", "lg", "gree", "midea", "hisense", "condor", "tcl", "hyundai",
    "biolux", "saba", "comfee", "indesit", "maxwell", "focus", "whirlpool", "brandt", "beko",
    "bosch", "haier", "sharp", "toshiba", "apple", "iphone", "xiaomi", "huawei", "oppo",
    "realme", "lenovo", "hp", "dell", "asus", "acer", "msi", "macbook", "sony", "jbl",
    "canon", "epson", "brother", "orient", "unionaire", "kenwood", "moulinex",
    "philips", "rowenta", "tefal", "nvidia", "amd", "intel", "logitech", "redragon",
    // informatique / bureautique additionnels
    "gigabyte", "corsair", "kingston", "crucial", "seagate", "western digital", "wd",
    "sandisk", "razer", "steelseries", "hyperx", "cooler master", "thermaltake", "nzxt",
    "benq", "aoc", "viewsonic", "lexmark", "ricoh", "xerox", "kyocera", "pantum",
    "tp-link", "d-link", "tplink", "netgear", "cisco", "mikrotik", "ubiquiti",
    "microsoft", "lg gram", "huawei", "honor", "infinix", "tecno", "vivo", "nokia",
    // électroménager additionnels
    "arcelik", "montblanc", "mont blanc", "telefunken", "nikai", "geepas", "westpoint",
    "delonghi", "de'longhi", "siemens", "candy", "electrolux", "ariston", "aeg",
    "panasonic", "daewoo", "arras", "vestel", "iris", "star", "newstar", "kata"];
  for (const b of brands) if (new RegExp(`\\b${b.replace(/[-']/g, "[-' ]?")}\\b`).test(n)) { specs.marque = b.replace(/[-' ]/g, ""); break; }
  // Normalisation des marques équivalentes (shops différents nomment autrement)
  if (specs.marque === "iphone") specs.marque = "apple";
  if (specs.marque === "galaxy") specs.marque = "samsung";
  if (specs.marque === "macbook") specs.marque = "apple";

  return specs;
}

// Attributs CRITIQUES : s'ils diffèrent → produits certainement différents
const CRITICAL_ATTRS = [
  "ram_go", "stockage_go", "ecran_pouces", "btu", "litres", "kg",
  "gpu", "cpu_model", "resolution", "hz", "mah", "camera_mp",
  "watts", "reseau", "vitesse_kmh", "essorage_trs", "couverts", "va", "canaux",
  "modele", "imprimante_tech", "format_papier", "foyers", "cuisson_energie",
  "frigo_type", "vram_go", "lavage_type",
];

/** Seuil d'écart de prix toléré selon le montant. */
export function priceGapAllowed(price: number): number {
  if (price < 500) return 0.25;
  if (price < 3000) return 0.20;
  return 0.15;
}

export function specsCompatible(a: Specs, b: Specs): { ok: boolean; reason: string } {
  for (const attr of CRITICAL_ATTRS) {
    const va = a[attr];
    const vb = b[attr];
    if (va !== undefined && vb !== undefined && va !== vb) {
      return { ok: false, reason: `${attr} différent (${va} vs ${vb})` };
    }
  }
  return { ok: true, reason: "compatible" };
}

/**
 * TYPE DE PRODUIT (catégorie grossière) déduit du nom.
 * Sert de garde-fou : "smartphone xiaomi" ne doit PAS renvoyer un
 * "Vélo électrique Xiaomi" ni un "Chargeur Xiaomi".
 * On liste les types du PLUS spécifique au plus générique ; le premier qui
 * matche gagne. Retourne null si le type n'est pas identifiable.
 */
const TYPE_PATTERNS: [string, RegExp][] = [
  // ── ACCESSOIRES / PÉRIPHÉRIQUES en PREMIER : un "Écouteurs Xiaomi Redmi" ou
  //    une "Commande Climatiseur" ne doivent PAS être typés smartphone/climatiseur.
  ["accessoire", /commande\s*climatiseur|t[ée]l[ée]commande|manette|interrupteur|power\s*bank|batterie\s*externe|\bchargeur\b|\bc[âa]ble\b|adaptateur|coque|housse|[ée]tui|support\b|\bsacoche\b|nappe|charni[èe]re/],
  ["casque", /\bcasque\b|\b[ée]couteurs?\b|earbuds|airpods|kit\s*mains?\s*libres?/],
  ["enceinte", /enceinte|haut[- ]parleur|barre\s*de\s*son|soundbar|\bspeaker\b/],
  // ── mobilité (avant "smart" — un vélo "Mi Smart" ne doit pas passer pour un tel)
  ["velo", /\bv[ée]lo\b|bicyclette|\bvtt\b|\be-?bike\b/],
  ["trottinette", /trottinette|scooter\s*[ée]lectrique|hoverboard|gyroroue/],
  ["moto", /\bmoto\b|scooter\b(?!.*[ée]lectrique)|cyclomoteur/],
  // ── informatique (avant téléphonie : "PC" est très spécifique)
  ["pc_portable", /pc\s*portable|ordinateur\s*portable|laptop|notebook|macbook|\bultrabook\b/],
  ["pc_bureau", /pc\s*(?:de\s*)?bureau|pc\s*gamer|unit[ée]\s*centrale|desktop|all\s*in\s*one/],
  ["ecran", /\b[ée]cran\b|moniteur|monitor/],
  ["imprimante", /imprimante|multifonction|\bmfp\b|printer/],
  ["composant", /carte\s*graphique|carte\s*m[èe]re|processeur\b|barrette|\bssd\b|disque\s*dur|\bram\b\s*\d|alimentation\s*\d+w/],
  // ── téléphonie
  ["tablette", /tablette|\bipad\b|\btab\s*[a-z]?\d/],
  ["montre", /montre|smartwatch|\bwatch\b|bracelet\s*connect/],
  ["smartphone", /smartphone|t[ée]l[ée]phone\s*portable|iphone|galaxy|redmi|\bnote\s*\d|honor|smartphon/],
  // ── réseau
  ["reseau", /routeur|\brouter\b|\bswitch\b|point\s*d['e ]?acc[èe]s|r[ée]p[ée]teur|\bmodem\b/],
  // ── image
  ["tv", /\bt[ée]l[ée]vis|\btv\b|smart\s*tv/],
  ["camera", /\bcam[ée]ra\b|appareil\s*photo|webcam/],
  // ── électroménager
  ["climatiseur", /climatiseur|\bclim\b|split\s*system/],
  ["refrigerateur", /r[ée]frig[ée]rateur|\bfrigo\b|cong[ée]lateur/],
  ["lave_linge", /machine\s*[àa]\s*laver|lave[- ]linge|s[ée]che[- ]linge/],
  ["lave_vaisselle", /lave[- ]vaisselle/],
  ["four", /\bfour\b|cuisini[èe]re|micro[- ]ondes|plaque\s*de\s*cuisson/],
  ["aspirateur", /aspirateur|nettoyeur\s*vapeur/],
  // ── petit électroménager cuisine (bouilloire, mixeur, cafetière…)
  ["petit_electro", /bouilloire|mixeur|blender|robot\s*(?:de\s*)?cuisine|cafeti[èe]re|grille[- ]pain|friteuse|hachoir|centrifugeuse|extracteur\s*de\s*jus|balance\s*(?:de\s*)?cuisine|fer\s*[àa]\s*repasser|ventilateur|chauffage|radiateur/],
];

export function productType(name: string): string | null {
  const n = norm(name);
  for (const [type, re] of TYPE_PATTERNS) if (re.test(n)) return type;
  return null;
}

/**
 * Noms de PRODUITS (le "noun" principal). Si l'utilisateur commence sa requête
 * par l'un d'eux, le titre du produit DOIT contenir ce mot (ou un synonyme)
 * près du début. Ex : "climatiseur condor" → le titre doit mener avec
 * "climatiseur", pas "Condor Machine à Café".
 * Chaque entrée : mot-clé requête → regex des formes acceptées dans le titre.
 */
const PRODUCT_NOUNS: [RegExp, RegExp][] = [
  [/^climatiseur|^clim$/, /climatiseur|\bclim\b|split/],
  [/^smartphone|^telephone|^tel$/, /smartphone|t[ée]l[ée]phone|iphone|galaxy|redmi|smartphon/],
  [/^tablette/, /tablette|\bipad\b|\btab\b/],
  [/^pc$|^ordinateur|^laptop|^portable/, /pc\b|ordinateur|laptop|notebook|macbook/],
  [/^imprimante/, /imprimante|multifonction|printer/],
  [/^ecran|^moniteur/, /[ée]cran|moniteur|monitor/],
  [/^tv$|^television|^televiseur/, /\btv\b|t[ée]l[ée]vis/],
  [/^casque|^ecouteur|^ecouteurs/, /casque|[ée]couteur|earbuds|airpods/],
  [/^enceinte|^haut-parleur/, /enceinte|haut[- ]parleur|barre\s*de\s*son|soundbar/],
  [/^refrigerateur|^frigo/, /r[ée]frig[ée]rateur|\bfrigo\b/],
  [/^congelateur/, /cong[ée]lateur/],
  [/^machine$|^lave-linge|^laveuse/, /machine\s*[àa]\s*laver|lave[- ]linge/],
  [/^lave-vaisselle/, /lave[- ]vaisselle/],
  [/^four$/, /\bfour\b/],
  [/^micro-?onde|^microonde/, /micro[- ]?onde/],
  [/^cuisiniere/, /cuisini[èe]re/],
  [/^hotte/, /\bhotte\b/],
  [/^aspirateur/, /aspirateur/],
  [/^routeur|^router/, /routeur|router/],
  [/^camera/, /cam[ée]ra|webcam/],
  [/^montre|^smartwatch/, /montre|smartwatch|\bwatch\b/],
  [/^velo/, /\bv[ée]lo\b|bicyclette|vtt/],
  [/^trottinette/, /trottinette/],
  [/^cafetiere|^machine.*cafe/, /cafeti[èe]re|machine\s*[àa]\s*caf[ée]/],
  [/^bouilloire/, /bouilloire/],
  [/^mixeur|^blender/, /mixeur|blender/],
  [/^friteuse/, /friteuse/],
  [/^ventilateur/, /ventilateur/],
  [/^clavier/, /clavier/],
  [/^souris/, /souris|\bmouse\b/],
];

/**
 * Le titre du produit respecte-t-il le "noun" de tête de la requête ?
 * Retourne true si aucun noun de tête n'est identifié (pas de contrainte).
 */
function leadingNounOK(queryText: string, prodName: string): boolean {
  const q = norm(queryText).trim();
  const n = norm(prodName);
  const firstWord = q.split(/\s+/)[0] || "";
  for (const [qre, titleRe] of PRODUCT_NOUNS) {
    if (qre.test(q) || qre.test(firstWord)) {
      // La requête désigne ce produit → le titre doit contenir la forme attendue
      // ET ce mot doit apparaître tôt (dans les 35 premiers caractères du titre).
      const m = n.match(titleRe);
      if (!m) return false;
      if ((m.index ?? 99) > 35) return false;
      return true;
    }
  }
  return true; // pas de noun de tête reconnu → pas de contrainte
}

/**
 * GARDE-FOU PRIX ABERRANT : fourchette de prix plausible par type de produit.
 * Un "climatiseur" à 15 DT = accessoire mal étiqueté (télécommande) → rejet.
 * Un "smartphone" à 50 000 DT = erreur de données → rejet.
 * Bornes volontairement LARGES (calées bien en-dessous du p2 réel du catalogue)
 * pour ne jamais rejeter un vrai produit, seulement le bruit évident.
 * [min, max] en DT.
 */
const PRICE_BANDS: Record<string, [number, number]> = {
  climatiseur:    [700, 25000],
  refrigerateur:  [400, 20000],
  lave_linge:     [200, 12000],
  lave_vaisselle: [400, 12000],
  four:           [120, 15000],
  smartphone:     [120, 12000],
  tablette:       [150, 12000],
  pc_portable:    [600, 30000],
  pc_bureau:      [400, 60000],
  ecran:          [150, 20000],
  imprimante:     [70,  20000],
  tv:             [250, 40000],
  camera:         [80,  40000],
  aspirateur:     [80,  8000],
  petit_electro:  [20,  6000],
  montre:         [30,  8000],
};

/** Le prix est-il aberrant pour le type de produit ? (true = à rejeter) */
export function isPriceOutlier(prodName: string, price: number): boolean {
  if (!(price > 0)) return true; // prix 0/invalide
  const t = productType(prodName);
  if (!t) return false;          // type inconnu → pas de contrainte
  const band = PRICE_BANDS[t];
  if (!band) return false;
  return price < band[0] || price > band[1];
}

/**
 * MODE CATALOGUE : le produit candidat correspond-il aux specs de la REQUÊTE ?
 * On ne compare QUE les attributs que l'user a explicitement tapés.
 * Ex : requête "climatiseur 12000" → queryS.btu=12000 → on garde tous
 *      les produits avec btu=12000 (toutes marques), on rejette les 18000/24000.
 *      La marque n'est PAS filtrée (sauf si l'user l'a tapée).
 *
 * queryText : texte brut de la requête (pour le garde-fou de TYPE de produit).
 * price : prix courant (pour le garde-fou de prix aberrant).
 */
export function matchesQuery(queryS: Specs, prodName: string, queryText?: string, price?: number): boolean {
  // ── GARDE-FOU PRIX ABERRANT (si le prix est fourni)
  if (price !== undefined && isPriceOutlier(prodName, price)) return false;

  // ── GARDE-FOU TYPE : si la requête désigne clairement un type de produit
  //    (smartphone, vélo, climatiseur…), on rejette les produits d'un autre type.
  if (queryText) {
    const qType = productType(queryText);
    if (qType) {
      const pType = productType(prodName);
      // Si le produit a un type identifié et qu'il est DIFFÉRENT → rejet.
      // (si le produit n'a pas de type identifiable, on reste indulgent)
      if (pType && pType !== qType) return false;
    }
    // ── GARDE-FOU "NOUN DE TÊTE" : le 1er mot tapé (ex "climatiseur") doit
    //    apparaître en tête du titre du produit. Rejette "Condor Machine à Café"
    //    pour la requête "climatiseur condor".
    if (!leadingNounOK(queryText, prodName)) return false;
  }

  const prodS = extractSpecs(prodName);
  // Pour chaque attribut présent dans la REQUÊTE, le produit doit correspondre
  for (const [attr, qval] of Object.entries(queryS)) {
    const pval = prodS[attr];
    if (pval === undefined) {
      // Le produit n'a pas cet attribut → indulgent SAUF pour les
      // attributs très discriminants tapés par l'user
      const strict = ["btu", "ram_go", "stockage_go", "litres", "kg", "ecran_pouces", "reseau", "modele"];
      if (strict.includes(attr)) return false;
      continue;
    }
    if (pval !== qval) return false;
  }
  return true;
}

/** Deux produits identiques (même marque + specs) → à regrouper.
 *  On IGNORE volontairement la couleur (non capturée) et, pour les
 *  téléphones identifiés par modèle, on ignore la RAM (souvent absente
 *  d'un shop à l'autre) pour ne pas fragmenter le groupe. */
export function sameGroupKey(name: string): string {
  const s = extractSpecs(name);
  const isPhoneModel = typeof s.modele === "string";
  const parts = [
    s.marque, s.modele, s.btu, s.clim_type, s.clim_mode,
    // pour un téléphone (modèle connu) la RAM ne doit pas diviser le groupe
    isPhoneModel ? undefined : s.ram_go,
    s.stockage_go, s.ecran_pouces,
    s.litres, s.kg, s.gpu, s.cpu_model, s.resolution,
    // bureautique / impression
    s.imprimante_tech, s.imprimante_fonction, s.format_papier,
    // cuisson / électroménager
    s.foyers, s.cuisson_energie, s.frigo_type,
    // camera/mah rarement listés partout → on ne les met que hors téléphonie
    isPhoneModel ? undefined : s.mah,
    isPhoneModel ? undefined : s.camera_mp,
  ].filter((x) => x !== undefined);
  // Il faut au moins 2 attributs pour regrouper, sinon on distingue par le nom
  if (parts.length < 2) return "solo:" + norm(name).replace(/[^a-z0-9]/g, "").slice(0, 45);
  return parts.join("|");
}
