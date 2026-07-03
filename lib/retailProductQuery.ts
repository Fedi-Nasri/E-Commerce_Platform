import { normalizeSearchText, appendProductSearch } from "@/lib/productSearch";

export const RETAIL_FILTER_SPECS = [
  {
    id: "ram",
    param: "spec_ram",
    keys: ["ram", "memory", "mémoire", "memoire"],
    label: "Mémoire RAM",
  },
  {
    id: "storage",
    param: "spec_storage",
    keys: ["storage", "stockage"],
    label: "Stockage",
  },
  {
    id: "screen",
    param: "spec_screen",
    keys: ["screen_size", "taille_ecran", "screen", "taille écran"],
    label: "Taille écran",
  },
] as const;

export const RETAIL_SORT_OPTIONS = [
  { value: "price_desc", label: "Prix décroissant" },
  { value: "price_asc", label: "Prix croissant" },
  { value: "shops_desc", label: "Plus de boutiques" },
  { value: "shops_asc", label: "Moins de boutiques" },
  { value: "name_asc", label: "Nom A → Z" },
  { value: "name_desc", label: "Nom Z → A" },
  { value: "relevance", label: "Pertinence", searchOnly: true },
] as const;

export type RetailSortOption = (typeof RETAIL_SORT_OPTIONS)[number]["value"];

const VALID_SORTS = new Set<string>(RETAIL_SORT_OPTIONS.map((o) => o.value));

export type RetailListFilters = {
  cat: string;
  q: string;
  shop: string;
  matched: string | null;
  brand: string;
  minPrice: number | null;
  maxPrice: number | null;
  specRam: string;
  specStorage: string;
  specScreen: string;
  sort: RetailSortOption;
};

export function parseRetailListFilters(sp: URLSearchParams): RetailListFilters {
  const minRaw = sp.get("min");
  const maxRaw = sp.get("max");
  const minPrice = minRaw != null && minRaw !== "" ? parseFloat(minRaw) : null;
  const maxPrice = maxRaw != null && maxRaw !== "" ? parseFloat(maxRaw) : null;

  const q = normalizeSearchText(sp.get("q") ?? "");
  const sortRaw = sp.get("sort");

  let sort: RetailSortOption = "price_desc";
  if (sortRaw && VALID_SORTS.has(sortRaw)) {
    sort = sortRaw as RetailSortOption;
  } else if (q) {
    sort = "relevance";
  }
  if (!q && sort === "relevance") {
    sort = "price_desc";
  }

  return {
    cat: (sp.get("cat") ?? "").trim().toLowerCase(),
    q,
    shop: (sp.get("shop") ?? "").trim().toLowerCase(),
    matched: sp.get("matched"),
    brand: (sp.get("brand") ?? "").trim(),
    minPrice: Number.isFinite(minPrice) ? minPrice : null,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : null,
    specRam: (sp.get("spec_ram") ?? "").trim(),
    specStorage: (sp.get("spec_storage") ?? "").trim(),
    specScreen: (sp.get("spec_screen") ?? "").trim(),
    sort,
  };
}

export function countActiveRetailFilters(f: RetailListFilters): number {
  let n = 0;
  if (f.cat) n++;
  if (f.shop) n++;
  if (f.brand) n++;
  if (f.minPrice != null) n++;
  if (f.maxPrice != null) n++;
  if (f.specRam) n++;
  if (f.specStorage) n++;
  if (f.specScreen) n++;
  if (f.matched === "true" || f.matched === "false") n++;
  return n;
}

const BASE_JOINS = `
  FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN product_subcategories psc ON psc.product_id = p.id
  LEFT JOIN subcategories sc ON sc.id = psc.subcategory_id
  LEFT JOIN low_categories lc ON lc.id = sc.low_category_id
  LEFT JOIN top_categories tc ON tc.id = lc.top_category_id
  LEFT JOIN shop_prices sp ON sp.product_id = p.id
  LEFT JOIN shops s ON s.id = sp.shop_id
`;

function resolveRetailOrderBy(sort: RetailSortOption, searchRelevanceOrder: string | null): string {
  const priceAsc = "MIN(sp.current_price) ASC NULLS LAST, p.name ASC";
  const priceDesc = "MIN(sp.current_price) DESC NULLS LAST, p.name ASC";

  if (sort === "relevance" && searchRelevanceOrder) {
    return `${searchRelevanceOrder}, ${priceAsc}`;
  }

  switch (sort) {
    case "price_desc":
      return priceDesc;
    case "shops_desc":
      return "COUNT(DISTINCT s.shop_key) DESC, MIN(sp.current_price) ASC NULLS LAST";
    case "shops_asc":
      return "COUNT(DISTINCT s.shop_key) ASC, MIN(sp.current_price) ASC NULLS LAST";
    case "name_asc":
      return "p.name ASC";
    case "name_desc":
      return "p.name DESC";
    case "price_asc":
      if (searchRelevanceOrder) {
        return `${searchRelevanceOrder}, ${priceAsc}`;
      }
      return priceAsc;
    default:
      if (searchRelevanceOrder) {
        return `${searchRelevanceOrder}, ${priceDesc}`;
      }
      return priceDesc;
  }
}

export function buildRetailProductQuery(filters: RetailListFilters) {
  const conditions: string[] = [];
  const having: string[] = [];
  const params: (string | number | boolean | string[])[] = [];
  let searchRelevanceOrder: string | null = null;

  if (filters.matched === "true") {
    conditions.push("p.is_matched = TRUE");
  } else if (filters.matched === "false") {
    conditions.push("p.is_matched = FALSE");
  }

  if (filters.cat) {
    const slugs = filters.cat.split(",").map((s) => s.trim()).filter(Boolean);
    if (slugs.length === 1) {
      params.push(slugs[0]);
      conditions.push(
        `(tc.slug = $${params.length} OR lc.slug = $${params.length} OR sc.slug = $${params.length})`,
      );
    } else if (slugs.length > 1) {
      const placeholders = slugs.map((slug) => {
        params.push(slug);
        return `$${params.length}`;
      });
      const inList = placeholders.join(",");
      conditions.push(`(tc.slug IN (${inList}) OR lc.slug IN (${inList}) OR sc.slug IN (${inList}))`);
    }
  }

  if (filters.q) {
    const searchOrder = appendProductSearch(filters.q, conditions, params);
    if (searchOrder) searchRelevanceOrder = searchOrder;
  }

  if (filters.shop) {
    params.push(filters.shop);
    conditions.push(`p.id IN (
      SELECT sp2.product_id FROM shop_prices sp2
      JOIN shops s2 ON s2.id = sp2.shop_id
      WHERE s2.shop_key = $${params.length}
    )`);
  }

  if (filters.brand) {
    params.push(filters.brand.toLowerCase());
    conditions.push(`lower(b.name) = $${params.length}`);
  }

  const specValues: { keys: readonly string[]; value: string }[] = [
    { keys: RETAIL_FILTER_SPECS[0].keys, value: filters.specRam },
    { keys: RETAIL_FILTER_SPECS[1].keys, value: filters.specStorage },
    { keys: RETAIL_FILTER_SPECS[2].keys, value: filters.specScreen },
  ];

  for (const spec of specValues) {
    if (!spec.value) continue;
    params.push([...spec.keys], spec.value.toLowerCase());
    const keysIdx = params.length - 1;
    const valIdx = params.length;
    conditions.push(`EXISTS (
      SELECT 1 FROM product_specs ps_f
      WHERE ps_f.product_id = p.id
        AND ps_f.spec_key = ANY($${keysIdx}::text[])
        AND lower(ps_f.spec_value) = $${valIdx}
    )`);
  }

  if (filters.minPrice != null) {
    params.push(filters.minPrice);
    having.push(`MIN(sp.current_price) >= $${params.length}`);
  }
  if (filters.maxPrice != null) {
    params.push(filters.maxPrice);
    having.push(`MIN(sp.current_price) <= $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const havingClause = having.length > 0 ? `HAVING ${having.join(" AND ")}` : "";
  const orderBy = resolveRetailOrderBy(filters.sort, searchRelevanceOrder);

  return {
    baseJoins: BASE_JOINS,
    where,
    having: havingClause,
    params,
    orderBy,
  };
}

export function buildRetailContextWhere(filters: RetailListFilters) {
  const clone = { ...filters, brand: "", minPrice: null, maxPrice: null, specRam: "", specStorage: "", specScreen: "" };
  const { where, params } = buildRetailProductQuery(clone);
  return { where, params };
}
