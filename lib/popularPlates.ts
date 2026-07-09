import ojjaStrictRaw from "@/lib/data/plat-populaire-ojja-simple-same-products-v2.json";
import makrounaStrictRaw from "@/lib/data/plat-populaire-makrouna-thon-same-products-v2.json";
import ojjaRealRaw from "@/lib/data/plat-populaire-ojja-simple-real-data-v2.json";
import makrounaRealRaw from "@/lib/data/plat-populaire-makrouna-thon-real-data-v2.json";

export const PLATE_IDS = ["ojja-simple", "makrouna-thon"] as const;
export type PlateId = (typeof PLATE_IDS)[number];

export type PlateClusterId =
  | "carrefour-family"
  | "carrefour-market-glovo"
  | "geant-monoprix";

export type PlateProductRow = {
  ingredient: string;
  canonicalProductId: string;
  productName: string;
  brand: string;
  price: number;
  consumedCost: number;
  usedQuantityNote: string;
  url: string | null;
};

export type PlateShopTotal = {
  shopName: string;
  ingredientCount: number;
  complete: boolean;
  basketTotal: number;
  estimatedConsumedTotal: number;
  rank: number;
  isCheapest: boolean;
};

export type PlateCluster = {
  id: PlateClusterId;
  label: string;
  shops: string[];
  ingredients: { ingredient: string; productId: string; productName: string }[];
  totals: PlateShopTotal[];
};

export type PlateRealShopTotal = {
  shopName: string;
  ingredientCount: number;
  basketTotal: number;
  estimatedConsumedTotal: number;
  rank: number;
  isCheapest: boolean;
};

export type StrictPlateReport = {
  id: PlateId;
  slug: PlateId;
  title: string;
  arabicTitle: string;
  image: string;
  generatedAt: string;
  recipeAssumption: string[];
  limitation: string;
  clusters: PlateCluster[];
  featuredClusterId: PlateClusterId;
  featuredShop: string;
  featuredConsumedTotal: number;
  orbitIngredients: OrbitIngredient[];
};

export type OrbitIngredient = {
  name: string;
  qty: string;
  /** Prix catalogue du produit (enseigne) */
  price: string;
  /** Coût consommé pour la portion du plat */
  portionPrice: string;
  icon: string;
  accent: string;
};

export type RealPlateReport = {
  id: PlateId;
  dish: string;
  generatedAt: string;
  note: string;
  totals: PlateRealShopTotal[];
};

type StrictRaw = {
  plate: PlateId;
  title: string;
  generated_at: string;
  limitation: string;
  recipe_assumption: string[];
  clusters: {
    cluster_id: PlateClusterId;
    shops: string[];
    ingredient_product_ids: { ingredient: string; product_id: string; product_name: string }[];
  }[];
  totals: {
    cluster_id: PlateClusterId;
    shop_name: string;
    ingredient_count: number;
    complete: boolean;
    basket_total: number;
    estimated_consumed_total: number;
  }[];
  product_rows: {
    cluster_id: PlateClusterId;
    shop_name: string;
    ingredient: string;
    canonical_product_id: string;
    product_name: string;
    brand: string;
    price: number;
    consumed_cost: number;
    used_quantity_note: string;
    url?: string;
  }[];
};

type RealRaw = {
  dish: string;
  generated_at: string;
  note: string;
  totals: {
    shop_name: string;
    ingredient_count: number;
    basket_total: number;
    estimated_consumed_total: number;
  }[];
};

const CLUSTER_LABELS: Record<PlateClusterId, string> = {
  "carrefour-family": "Famille Carrefour",
  "carrefour-market-glovo": "Carrefour + Monoprix Glovo",
  "geant-monoprix": "Géant + Monoprix",
};

const PLATE_META: Record<
  PlateId,
  { arabicTitle: string; image: string }
> = {
  "ojja-simple": { arabicTitle: "عجة بسيطة", image: "/ojja.png" },
  "makrouna-thon": { arabicTitle: "مكرونة بالتونة", image: "/pasta-plate.png" },
};

const INGREDIENT_ICONS: Record<string, string> = {
  Oeufs: "/food/egg.svg",
  "Tomate/concentre": "/food/tomato-paste.svg",
  Harissa: "/food/harissa.svg",
  Huile: "/food/oil.svg",
  Cumin: "/food/salt.svg",
  Spaghetti: "/food/tomato.svg",
  Thon: "/food/tomato-paste.svg",
};

const INGREDIENT_ACCENTS: Record<string, string> = {
  Oeufs: "#fbbf24",
  "Tomate/concentre": "#dc2626",
  Harissa: "#fb923c",
  Huile: "#eab308",
  Cumin: "#a78bfa",
  Spaghetti: "#facc15",
  Thon: "#60a5fa",
};

const RECIPE_INGREDIENT_ORDER: Record<PlateId, string[]> = {
  "ojja-simple": ["Oeufs", "Tomate/concentre", "Harissa", "Huile", "Cumin"],
  "makrouna-thon": ["Spaghetti", "Thon", "Tomate/concentre", "Harissa", "Huile", "Cumin"],
};

function formatOrbitQuantity(note: string, ingredient: string): string {
  const n = note.toLowerCase();
  if (n.includes("4 egg")) return "4 œufs";
  if (n.includes("20g")) return "20 g harissa";
  if (n.includes("30ml")) return "30 ml";
  if (n.includes("5g")) return "5 g cumin";
  if (n.includes("400g") || n.includes("can used")) return "1 boîte tomate";
  if (ingredient === "Spaghetti") return "1 portion";
  if (ingredient === "Thon") return "1 boîte thon";
  const cleaned = note.replace(/^[^:]+:\s*/i, "").trim();
  if (!cleaned) return ingredient;
  return cleaned.length > 24 ? `${cleaned.slice(0, 22)}…` : cleaned;
}

function sortOrbitRows(rows: StrictRaw["product_rows"], plateId: PlateId) {
  const order = RECIPE_INGREDIENT_ORDER[plateId];
  return [...rows].sort((a, b) => {
    const ai = order.indexOf(a.ingredient);
    const bi = order.indexOf(b.ingredient);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

export function fmtDt(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function rankTotals<T extends { estimatedConsumedTotal: number }>(
  rows: T[],
): (T & { rank: number; isCheapest: boolean })[] {
  const sorted = [...rows].sort(
    (a, b) => a.estimatedConsumedTotal - b.estimatedConsumedTotal,
  );
  return sorted.map((row, i) => ({
    ...row,
    rank: i + 1,
    isCheapest: i === 0,
  }));
}

function parseStrict(raw: StrictRaw): StrictPlateReport {
  const clusters: PlateCluster[] = raw.clusters.map((c) => {
    const clusterTotals = raw.totals
      .filter((t) => t.cluster_id === c.cluster_id && t.complete)
      .map((t) => ({
        shopName: t.shop_name,
        ingredientCount: t.ingredient_count,
        complete: t.complete,
        basketTotal: t.basket_total,
        estimatedConsumedTotal: t.estimated_consumed_total,
        rank: 0,
        isCheapest: false,
      }));

    return {
      id: c.cluster_id,
      label: CLUSTER_LABELS[c.cluster_id],
      shops: c.shops,
      ingredients: c.ingredient_product_ids.map((i) => ({
        ingredient: i.ingredient,
        productId: i.product_id,
        productName: i.product_name,
      })),
      totals: rankTotals(clusterTotals),
    };
  });

  let featuredClusterId: PlateClusterId = clusters[0]?.id ?? "carrefour-family";
  let featuredShop = "";
  let featuredConsumedTotal = Infinity;

  for (const cluster of clusters) {
    const leader = cluster.totals[0];
    if (leader && leader.estimatedConsumedTotal < featuredConsumedTotal) {
      featuredConsumedTotal = leader.estimatedConsumedTotal;
      featuredClusterId = cluster.id;
      featuredShop = leader.shopName;
    }
  }

  const orbitRows = sortOrbitRows(
    raw.product_rows.filter(
      (r) => r.cluster_id === featuredClusterId && r.shop_name === featuredShop,
    ),
    raw.plate,
  );

  const orbitIngredients: OrbitIngredient[] = orbitRows.map((r) => ({
    name: r.ingredient,
    qty: formatOrbitQuantity(r.used_quantity_note, r.ingredient),
    price: fmtDt(r.price),
    portionPrice: fmtDt(r.consumed_cost),
    icon: INGREDIENT_ICONS[r.ingredient] ?? "/food/ojja.svg",
    accent: INGREDIENT_ACCENTS[r.ingredient] ?? "#f6c453",
  }));

  const meta = PLATE_META[raw.plate];

  return {
    id: raw.plate,
    slug: raw.plate,
    title: raw.title,
    arabicTitle: meta.arabicTitle,
    image: meta.image,
    generatedAt: raw.generated_at,
    recipeAssumption: raw.recipe_assumption,
    limitation: raw.limitation,
    clusters,
    featuredClusterId,
    featuredShop,
    featuredConsumedTotal: Number.isFinite(featuredConsumedTotal) ? featuredConsumedTotal : 0,
    orbitIngredients,
  };
}

function parseReal(plateId: PlateId, raw: RealRaw): RealPlateReport {
  const totals = rankTotals(
    raw.totals.map((t) => ({
      shopName: t.shop_name,
      ingredientCount: t.ingredient_count,
      basketTotal: t.basket_total,
      estimatedConsumedTotal: t.estimated_consumed_total,
      rank: 0,
      isCheapest: false,
    })),
  );

  return {
    id: plateId,
    dish: raw.dish,
    generatedAt: raw.generated_at,
    note: raw.note,
    totals,
  };
}

let cache: {
  strict: StrictPlateReport[];
  real: RealPlateReport[];
} | null = null;

export function getPopularPlatesData() {
  if (!cache) {
    cache = {
      strict: [
        parseStrict(ojjaStrictRaw as StrictRaw),
        parseStrict(makrounaStrictRaw as StrictRaw),
      ],
      real: [
        parseReal("ojja-simple", ojjaRealRaw as RealRaw),
        parseReal("makrouna-thon", makrounaRealRaw as RealRaw),
      ],
    };
  }
  return cache;
}

export function getStrictPlate(slug: string): StrictPlateReport | null {
  return getPopularPlatesData().strict.find((p) => p.slug === slug) ?? null;
}

export function getRealPlate(slug: PlateId): RealPlateReport | null {
  return getPopularPlatesData().real.find((p) => p.id === slug) ?? null;
}

export function getPlateProductRows(
  raw: StrictRaw,
  clusterId: PlateClusterId,
  shopName: string,
): PlateProductRow[] {
  return raw.product_rows
    .filter((r) => r.cluster_id === clusterId && r.shop_name === shopName)
    .map((r) => ({
      ingredient: r.ingredient,
      canonicalProductId: r.canonical_product_id,
      productName: r.product_name,
      brand: r.brand,
      price: r.price,
      consumedCost: r.consumed_cost,
      usedQuantityNote: r.used_quantity_note,
      url: r.url ?? null,
    }));
}

export function getStrictPlateRaw(slug: PlateId): StrictRaw | null {
  if (slug === "ojja-simple") return ojjaStrictRaw as StrictRaw;
  if (slug === "makrouna-thon") return makrounaStrictRaw as StrictRaw;
  return null;
}

export function fmtDateFr(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}
