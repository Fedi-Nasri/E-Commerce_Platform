import { catalogPool, retailPool } from "@/lib/db";
import { appendCatalogShopSearch, appendProductSearch, normalizeSearchText, slugifySearch } from "@/lib/productSearch";
import { formatSpecLabel, HIDDEN_SPEC_KEYS } from "@/lib/productSpecLabels";
import { RETAIL_CATEGORY_SLUGS } from "@/lib/retailCategories";

export type SpecMap = Record<string, string>;

export type CompareOffer = {
  shop: string;
  shopSlug: string;
  logo: string | null;
  price: number;
  url: string | null;
};

export type CompareProductPayload = {
  slug: string;
  name: string;
  brand: string;
  img: string;
  category: { top: string | null; low: string | null; sub: string | null };
  minPrice: number | null;
  maxPrice: number | null;
  offers: CompareOffer[];
  shopCount: number;
  description: string | null;
  specs: SpecMap;
  hasSpecs: boolean;
  specCount: number;
  reference: string | null;
};

export type CompareSearchItem = {
  slug: string;
  name: string;
  brand: string;
  img: string;
  price: number | null;
  category: string;
  shopCount: number;
  specCount: number;
  reference: string | null;
  source: "retail" | "catalog";
};

function sanitizeImage(raw: string | null | undefined): string {
  if (!raw) return "";
  const matches = String(raw).match(/https?:\/\/\S+\.(?:jpg|jpeg|png|webp|gif|avif)(?:\?[^\s"']*)?/gi);
  if (matches?.length) return matches[matches.length - 1]!;
  return String(raw).trim().split(/\s+/).pop() ?? "";
}

function sanitizeText(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw).replace(/chevron_right/gi, "").replace(/\s+/g, " ").trim();
}

function specKeyNorm(key: string): string {
  return key
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s]+/g, " ")
    .trim();
}

export function normalizeCatalogSpecs(raw: unknown): SpecMap {
  const out: SpecMap = {};
  if (!raw) return out;
  if (Array.isArray(raw)) {
    for (const e of raw) {
      if (e && typeof e === "object") {
        const o = e as Record<string, unknown>;
        const k = (o.name ?? o.label ?? o.key ?? o.title) as string | undefined;
        const v = (o.value ?? o.val ?? o.text) as unknown;
        if (k != null && v != null && String(v).trim()) out[String(k).trim()] = String(v).trim();
      }
    }
    return out;
  }
  if (typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v == null) continue;
      const val = typeof v === "object" ? JSON.stringify(v) : String(v);
      if (val.trim()) out[k.trim()] = val.trim();
    }
  }
  return out;
}

export function retailSpecsToMap(rows: { spec_key: string; spec_value: string }[]): SpecMap {
  const out: SpecMap = {};
  for (const row of rows) {
    if (!row.spec_key || !row.spec_value || HIDDEN_SPEC_KEYS.has(row.spec_key)) continue;
    const label = formatSpecLabel(row.spec_key);
    const val = row.spec_value.trim();
    if (!val) continue;
    if (!out[label] || val.length > out[label].length) out[label] = val;
  }
  return out;
}

export function mergeSpecMaps(...maps: SpecMap[]): SpecMap {
  const merged: SpecMap = {};
  const index = new Map<string, string>();

  for (const map of maps) {
    for (const [key, value] of Object.entries(map)) {
      if (!value?.trim()) continue;
      const norm = specKeyNorm(key);
      const existing = index.get(norm);
      if (!existing || value.length > merged[existing]!.length) {
        if (existing && existing !== key) delete merged[existing];
        index.set(norm, key);
        merged[key] = value.trim();
      }
    }
  }
  return merged;
}

function mergeOffers(lists: CompareOffer[][]): CompareOffer[] {
  const byShop = new Map<string, CompareOffer>();
  for (const list of lists) {
    for (const o of list) {
      const key = o.shopSlug || o.shop;
      const prev = byShop.get(key);
      if (!prev || o.price < prev.price) byShop.set(key, o);
    }
  }
  return Array.from(byShop.values()).sort((a, b) => a.price - b.price);
}

const TECH_KEYWORDS = [
  "smartphone", "telephone", "téléphone", "phone", "mobile", "gsm",
  "tablette", "tablet", "ipad",
  "pc portable", "ordinateur", "laptop", "notebook", "macbook",
  "pc bureau", "desktop", "informatique", "composant", "processeur", "cpu",
  "carte graphique", "gpu", "carte mere", "carte mère", "motherboard",
  "ram", "memoire", "mémoire", "ssd", "disque dur", "stockage",
  "ecran", "écran", "moniteur", "monitor", "clavier", "souris",
  "imprimante", "gaming", "console",
];

function retailTechFilterSql(params: (string | number | boolean | string[])[]): string {
  params.push([...RETAIL_CATEGORY_SLUGS]);
  const idx = params.length;
  return `(tc.slug = ANY($${idx}::text[]) OR lc.slug = ANY($${idx}::text[]) OR sc.slug = ANY($${idx}::text[]))`;
}

async function fetchRetailBySlug(slug: string): Promise<CompareProductPayload | null> {
  const pool = retailPool();
  const headRes = await pool.query<{
    id: number;
    name: string;
    slug: string;
    source_product_id: string | null;
    brand: string | null;
    top_cat: string | null;
    low_cat: string | null;
    sub_cat: string | null;
    img: string | null;
  }>(
    `SELECT p.id, p.name, p.slug, p.source_product_id,
            COALESCE(b.name, '') AS brand,
            tc.name AS top_cat, lc.name AS low_cat, sc.name AS sub_cat,
            (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.image_url NOT ILIKE '%yatoo.com.tn%' ORDER BY pi.id ASC LIMIT 1) AS img
     FROM products p
     LEFT JOIN brands b ON b.id = p.brand_id
     LEFT JOIN product_subcategories psc ON psc.product_id = p.id
     LEFT JOIN subcategories sc ON sc.id = psc.subcategory_id
     LEFT JOIN low_categories lc ON lc.id = sc.low_category_id
     LEFT JOIN top_categories tc ON tc.id = lc.top_category_id
     WHERE p.slug = $1 AND p.status = 'active'
     LIMIT 1`,
    [slug],
  );
  if (!headRes.rows.length) return null;
  const head = headRes.rows[0]!;

  const [offersRes, specsRes] = await Promise.all([
    pool.query<{ shop_name: string; shop_key: string; shop_product_url: string | null; current_price: string }>(
      `SELECT s.name AS shop_name, s.shop_key, sp.shop_product_url, sp.current_price
       FROM shop_prices sp
       JOIN shops s ON s.id = sp.shop_id
       WHERE sp.product_id = $1
       ORDER BY sp.current_price ASC`,
      [head.id],
    ),
    pool.query<{ spec_key: string; spec_value: string }>(
      `SELECT ps.spec_key, ps.spec_value
       FROM product_specs ps
       WHERE ps.product_id = $1
         AND ps.spec_key NOT IN ('data_quality_score', 'shop_count')
       ORDER BY ps.id ASC`,
      [head.id],
    ),
  ]);

  const offers: CompareOffer[] = offersRes.rows
    .filter((r) => r.current_price != null)
    .map((r) => ({
      shop: r.shop_name,
      shopSlug: r.shop_key,
      logo: null,
      price: parseFloat(r.current_price),
      url: r.shop_product_url,
    }));

  const prices = offers.map((o) => o.price);
  const specs = retailSpecsToMap(specsRes.rows);

  return {
    slug: head.slug,
    name: sanitizeText(head.name),
    brand: sanitizeText(head.brand),
    img: sanitizeImage(head.img),
    category: { top: head.top_cat, low: head.low_cat, sub: head.sub_cat },
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    offers,
    shopCount: offers.length,
    description: null,
    specs,
    hasSpecs: Object.keys(specs).length > 0,
    specCount: Object.keys(specs).length,
    reference: head.source_product_id,
  };
}

async function fetchCatalogBySlug(slug: string): Promise<CompareProductPayload | null> {
  const pool = catalogPool();
  const rows = await pool.query(
    `SELECT p.id, p.name, p.brand, p.image, p.url, p.price, p.old_price,
            p.top_category, p.low_category, p.subcategory,
            s.name AS shop_name, s.slug AS shop_slug, s.logo_url AS shop_logo
     FROM products p
     JOIN shops s ON s.id = p.shop_id
     WHERE p.slug = $1
     ORDER BY p.price ASC NULLS LAST`,
    [slug],
  );
  if (!rows.rows.length) return null;

  const main = rows.rows[0]!;
  const ids = rows.rows.map((r: { id: number }) => r.id);
  const detRes = await pool.query(
    `SELECT product_id, brand, overview, description, specifications
     FROM product_details
     WHERE product_id = ANY($1::bigint[])`,
    [ids],
  );

  const specs: SpecMap = {};
  let description: string | null = null;
  let brand: string | null = main.brand ?? null;
  for (const d of detRes.rows) {
    const s = normalizeCatalogSpecs(d.specifications);
    for (const [k, v] of Object.entries(s)) {
      if (!specs[k] || v.length > specs[k]!.length) specs[k] = v;
    }
    const desc = d.overview ?? d.description;
    if (desc && (!description || desc.length > description.length)) description = desc;
    if (!brand && d.brand) brand = d.brand;
  }

  const offers: CompareOffer[] = rows.rows
    .filter((r: { price: string | null }) => r.price != null)
    .map((r: { shop_name: string; shop_slug: string; shop_logo: string | null; price: string; url: string | null }) => ({
      shop: r.shop_name,
      shopSlug: r.shop_slug,
      logo: r.shop_logo ?? null,
      price: parseFloat(r.price),
      url: r.url ?? null,
    }));

  const prices = offers.map((o) => o.price);
  return {
    slug,
    name: sanitizeText(main.name),
    brand: sanitizeText(brand),
    img: sanitizeImage(main.image),
    category: {
      top: sanitizeText(main.top_category) || null,
      low: sanitizeText(main.low_category) || null,
      sub: sanitizeText(main.subcategory) || null,
    },
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    offers,
    shopCount: offers.length,
    description,
    specs,
    hasSpecs: Object.keys(specs).length > 0,
    specCount: Object.keys(specs).length,
    reference: null,
  };
}

async function fetchCatalogByName(name: string): Promise<CompareProductPayload | null> {
  const pool = catalogPool();
  const slug = slugifySearch(name);
  const row = await pool.query<{ slug: string }>(
    `SELECT p.slug FROM products p
     WHERE lower(p.slug) = $1 OR lower(regexp_replace(trim(p.name), '\\s+', ' ', 'g')) = $2
     LIMIT 1`,
    [slug, normalizeSearchText(name).toLowerCase()],
  );
  if (!row.rows[0]) return null;
  return fetchCatalogBySlug(row.rows[0].slug);
}

async function enrichCatalogWithRetail(catalog: CompareProductPayload): Promise<CompareProductPayload> {
  const retailMatch = await retailPool().query<{ slug: string }>(
    `SELECT p.slug FROM products p
     WHERE lower(regexp_replace(trim(p.name), '\\s+', ' ', 'g')) = $1
        OR lower(p.slug) = $2
     LIMIT 1`,
    [normalizeSearchText(catalog.name).toLowerCase(), catalog.slug],
  );
  if (!retailMatch.rows[0]) return catalog;

  const retailExtra = await fetchRetailBySlug(retailMatch.rows[0].slug);
  if (!retailExtra) return catalog;

  const specs = mergeSpecMaps(catalog.specs, retailExtra.specs);
  const offers = mergeOffers([catalog.offers, retailExtra.offers]);
  const prices = offers.map((o) => o.price);
  return {
    ...catalog,
    slug: retailExtra.slug,
    specs,
    offers,
    shopCount: offers.length,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    hasSpecs: Object.keys(specs).length > 0,
    specCount: Object.keys(specs).length,
    reference: retailExtra.reference,
  };
}

export async function fetchCompareProduct(slug: string): Promise<CompareProductPayload | null> {
  const [retail, catalog] = await Promise.all([
    fetchRetailBySlug(slug),
    fetchCatalogBySlug(slug),
  ]);

  if (!retail && !catalog) return null;

  const primary = retail ?? catalog!;
  const secondary = retail && catalog ? catalog : null;

  let merged = primary;
  if (secondary) {
    const specs = mergeSpecMaps(retail!.specs, catalog!.specs);
    const offers = mergeOffers([retail!.offers, catalog!.offers]);
    const prices = offers.map((o) => o.price);
    merged = {
      slug: retail!.slug,
      name: retail!.name || catalog!.name,
      brand: retail!.brand || catalog!.brand,
      img: retail!.img || catalog!.img,
      category: retail!.category.top ? retail!.category : catalog!.category,
      minPrice: prices.length ? Math.min(...prices) : null,
      maxPrice: prices.length ? Math.max(...prices) : null,
      offers,
      shopCount: offers.length,
      description: catalog!.description ?? retail!.description,
      specs,
      hasSpecs: Object.keys(specs).length > 0,
      specCount: Object.keys(specs).length,
      reference: retail!.reference ?? catalog!.reference,
    };
  }

  if (!retail && catalog) {
    return enrichCatalogWithRetail(catalog);
  }

  if (retail && !catalog) {
    const catalogExtra = await fetchCatalogByName(retail.name);
    if (catalogExtra) {
      const specs = mergeSpecMaps(retail.specs, catalogExtra.specs);
      const offers = mergeOffers([retail.offers, catalogExtra.offers]);
      const prices = offers.map((o) => o.price);
      return {
        ...retail,
        specs,
        offers,
        shopCount: offers.length,
        minPrice: prices.length ? Math.min(...prices) : null,
        maxPrice: prices.length ? Math.max(...prices) : null,
        description: catalogExtra.description ?? retail.description,
        hasSpecs: Object.keys(specs).length > 0,
        specCount: Object.keys(specs).length,
      };
    }
  }

  return merged;
}

function searchScore(item: CompareSearchItem, q: string): number {
  const ql = normalizeSearchText(q).toLowerCase();
  const name = normalizeSearchText(item.name).toLowerCase();
  const ref = (item.reference ?? "").toLowerCase();
  const slugQ = slugifySearch(q);
  if (name === ql) return 0;
  if (ref === ql) return 1;
  if (item.slug === slugQ) return 2;
  if (name.startsWith(ql)) return 3;
  if (name.includes(ql)) return 4;
  if (ref.includes(ql)) return 5;
  return 6;
}

export async function searchCompareProducts(q: string, limit: number): Promise<CompareSearchItem[]> {
  const query = normalizeSearchText(q);
  if (query.length < 2) return [];

  const [retailItems, catalogItems] = await Promise.all([
    searchRetailCompare(query, limit),
    searchCatalogCompare(query, limit),
  ]);

  const byName = new Map<string, CompareSearchItem>();
  for (const item of [...retailItems, ...catalogItems]) {
    const key = normalizeSearchText(item.name).toLowerCase();
    const prev = byName.get(key);
    if (!prev) {
      byName.set(key, item);
      continue;
    }
    const better =
      (item.source === "retail" && prev.source !== "retail") ||
      item.specCount > prev.specCount ||
      (item.specCount === prev.specCount && item.shopCount > prev.shopCount);
    if (better) byName.set(key, item);
  }

  return Array.from(byName.values())
    .sort((a, b) => searchScore(a, query) - searchScore(b, query) || b.shopCount - a.shopCount)
    .slice(0, limit);
}

async function searchRetailCompare(q: string, limit: number): Promise<CompareSearchItem[]> {
  const pool = retailPool();
  const conditions: string[] = ["p.status = 'active'"];
  const params: (string | number | boolean | string[])[] = [];
  conditions.push(retailTechFilterSql(params));
  const relevanceOrder = appendProductSearch(q, conditions, params);
  const orderBy = relevanceOrder
    ? `${relevanceOrder}, COUNT(DISTINCT s.id) DESC`
    : "COUNT(DISTINCT s.id) DESC";

  const limitIdx = params.length + 1;
  const { rows } = await pool.query<{
    slug: string;
    name: string;
    brand: string;
    img: string | null;
    min_price: string;
    shop_count: string;
    category: string;
    spec_count: string;
    source_product_id: string | null;
  }>(
    `SELECT
      p.slug, p.name, COALESCE(b.name, '') AS brand,
      (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.image_url NOT ILIKE '%yatoo.com.tn%' ORDER BY pi.id ASC LIMIT 1) AS img,
      MIN(sp.current_price) AS min_price,
      COUNT(DISTINCT s.id) AS shop_count,
      COALESCE(tc.name, lc.name, sc.name, '') AS category,
      COUNT(DISTINCT ps.id) FILTER (WHERE ps.spec_key NOT IN ('data_quality_score', 'shop_count')) AS spec_count,
      p.source_product_id
    FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN product_subcategories psc ON psc.product_id = p.id
    LEFT JOIN subcategories sc ON sc.id = psc.subcategory_id
    LEFT JOIN low_categories lc ON lc.id = sc.low_category_id
    LEFT JOIN top_categories tc ON tc.id = lc.top_category_id
    JOIN shop_prices sp ON sp.product_id = p.id
    JOIN shops s ON s.id = sp.shop_id
    LEFT JOIN product_specs ps ON ps.product_id = p.id
    WHERE ${conditions.join(" AND ")}
    GROUP BY p.id, p.name, p.slug, b.name, tc.name, lc.name, sc.name, p.source_product_id
    ORDER BY ${orderBy}
    LIMIT $${limitIdx}`,
    [...params, limit],
  );

  return rows.map((r) => ({
    slug: r.slug,
    name: sanitizeText(r.name),
    brand: sanitizeText(r.brand),
    img: sanitizeImage(r.img),
    price: r.min_price != null ? parseFloat(r.min_price) : null,
    category: sanitizeText(r.category),
    shopCount: parseInt(r.shop_count, 10) || 0,
    specCount: parseInt(r.spec_count, 10) || 0,
    reference: r.source_product_id,
    source: "retail" as const,
  }));
}

async function searchCatalogCompare(q: string, limit: number): Promise<CompareSearchItem[]> {
  const pool = catalogPool();
  const params: (string | number | string[])[] = [TECH_KEYWORDS.map((k) => `%${k}%`)];
  const where: string[] = [
    "p.name IS NOT NULL",
    "p.image IS NOT NULL",
    `lower(coalesce(p.top_category,'') || ' ' ||
      coalesce(p.low_category,'') || ' ' ||
      coalesce(p.subcategory,'') || ' ' ||
      coalesce(p.name,'')) LIKE ANY ($1::text[])`,
  ];
  appendCatalogShopSearch(q, where, params as (string | number)[]);

  const sql = `
    SELECT slug, name, brand, image, price, top_category, shop_count, spec_count, source_product_id
    FROM (
      SELECT DISTINCT ON (lower(p.name))
             p.slug, p.name, p.brand, p.image, p.price, p.top_category,
             p.source_product_id,
             COUNT(*) OVER (PARTITION BY lower(p.name)) AS shop_count,
             (SELECT COUNT(*)::int FROM product_details pd WHERE pd.product_id = p.id
                AND pd.specifications IS NOT NULL AND pd.specifications::text NOT IN ('{}', '[]', 'null')) AS spec_count
      FROM products p
      WHERE ${where.join(" AND ")}
      ORDER BY lower(p.name), p.price ASC NULLS LAST
    ) t
    ORDER BY t.shop_count DESC, t.price ASC NULLS LAST
    LIMIT $${params.length + 1}
  `;

  const res = await pool.query(sql, [...params, limit]);
  return res.rows.map((r: {
    slug: string; name: string; brand: string | null; image: string | null;
    price: string | null; top_category: string | null; shop_count: string;
    spec_count: number; source_product_id: string | null;
  }) => ({
    slug: r.slug,
    name: sanitizeText(r.name),
    brand: sanitizeText(r.brand),
    img: sanitizeImage(r.image),
    price: r.price != null ? parseFloat(r.price) : null,
    category: sanitizeText(r.top_category),
    shopCount: parseInt(r.shop_count, 10) || 1,
    specCount: Number(r.spec_count) || 0,
    reference: r.source_product_id,
    source: "catalog" as const,
  }));
}
