import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import { parseCatalogSort, sortCatalogItems } from "@/lib/catalogFilters";
import { paraPool } from "@/lib/db";
import {
  appendProductSearch,
  matchesMemoryProductSearch,
  normalizeSearchText,
  slugifySearch,
  sortMemorySearchResults,
} from "@/lib/productSearch";
import { productCoverImageSql } from "@/lib/productImages";


export const revalidate = 300;

type Product = {
  name: string;
  brand: string;
  category: string;
  img: string;
  minPrice: number;
  maxPrice: number;
  shopNames: string[];
  discount: number | null;
};

type ProductWithUrl = Product & { bestUrl: string | null };

let cache: Product[] | null = null;

function loadData(): Product[] {
  if (cache) return cache;
  const file = path.join(process.cwd(), "app/api/para-products/data.json");
  cache = JSON.parse(readFileSync(file, "utf8")) as Product[];
  return cache;
}

async function fetchBestUrls(names: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (names.length === 0) return result;
  try {
    const pool = paraPool();
    const { rows } = await pool.query<{ name: string; shop_product_url: string }>(
      `SELECT DISTINCT ON (lower(p.name)) lower(p.name) AS name, sp.shop_product_url
       FROM products p
       JOIN shop_prices sp ON sp.product_id = p.id
       WHERE lower(p.name) = ANY($1::text[])
         AND sp.shop_product_url IS NOT NULL
       ORDER BY lower(p.name), sp.current_price ASC`,
      [names.map((n) => n.toLowerCase())],
    );
    for (const r of rows) result.set(r.name, r.shop_product_url);
  } catch {
    // DB unavailable
  }
  return result;
}

async function searchParaFromDb(
  q: string,
  cat: string,
  shop: string,
  minPrice: number | null,
  maxPrice: number | null,
  sort: ReturnType<typeof parseCatalogSort>,
  page: number,
  limit: number,
): Promise<{ total: number; items: Product[] } | null> {
  try {
    const pool = paraPool();
    const conditions: string[] = [];
    const having: string[] = [];
    const params: (string | number)[] = [];

    const relevanceOrder = appendProductSearch(q, conditions, params);

    if (cat) {
      params.push(`%${cat}%`);
      conditions.push(`EXISTS (
        SELECT 1 FROM product_subcategories psc
        JOIN subcategories sc ON sc.id = psc.subcategory_id
        JOIN low_categories lc ON lc.id = sc.low_category_id
        WHERE psc.product_id = p.id
          AND (lower(sc.name) LIKE $${params.length} OR lower(lc.name) LIKE $${params.length})
      )`);
    }

    if (shop) {
      params.push(shop);
      conditions.push(`EXISTS (
        SELECT 1 FROM shop_prices sp_f
        JOIN shops s_f ON s_f.id = sp_f.shop_id
        WHERE sp_f.product_id = p.id AND s_f.shop_key = $${params.length}
      )`);
    }

    if (minPrice != null && Number.isFinite(minPrice)) {
      params.push(minPrice);
      having.push(`MIN(sp.current_price) >= $${params.length}`);
    }
    if (maxPrice != null && Number.isFinite(maxPrice)) {
      params.push(maxPrice);
      having.push(`MIN(sp.current_price) <= $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const havingClause = having.length ? `HAVING ${having.join(" AND ")}` : "";
    const orderBy = relevanceOrder
      ? `${relevanceOrder}, MIN(sp.current_price) DESC NULLS LAST`
      : "MIN(sp.current_price) DESC NULLS LAST";

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const baseFrom = `
      FROM products p
      LEFT JOIN brands b ON b.id = p.brand_id
      JOIN shop_prices sp ON sp.product_id = p.id
      JOIN shops s ON s.id = sp.shop_id
    `;

    const [countRes, itemsRes] = await Promise.all([
      pool.query<{ total: string }>(
        `SELECT COUNT(*) AS total FROM (
          SELECT p.id ${baseFrom} ${where} GROUP BY p.id ${havingClause}
        ) m`,
        params,
      ),
      pool.query<{
        name: string;
        brand: string;
        img: string | null;
        min_price: string;
        max_price: string;
        shop_names: string[];
        category: string;
      }>(
        `SELECT
          p.name,
          COALESCE(b.name, '') AS brand,
          ${productCoverImageSql("p.id")} AS img,
          MIN(sp.current_price) AS min_price,
          MAX(sp.current_price) AS max_price,
          array_agg(DISTINCT s.name ORDER BY s.name) AS shop_names,
          COALESCE(
            (SELECT lc.name FROM product_subcategories psc
             JOIN subcategories sc ON sc.id = psc.subcategory_id
             JOIN low_categories lc ON lc.id = sc.low_category_id
             WHERE psc.product_id = p.id LIMIT 1),
            ''
          ) AS category
        ${baseFrom}
        ${where}
        GROUP BY p.id, p.name, b.name
        ${havingClause}
        ORDER BY ${orderBy}
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        [...params, limit, page * limit],
      ),
    ]);

    const items: Product[] = itemsRes.rows.map((r) => {
      const min = parseFloat(r.min_price) || 0;
      const max = parseFloat(r.max_price) || 0;
      return {
        name: r.name,
        brand: r.brand,
        category: r.category,
        img: r.img ?? "",
        minPrice: min,
        maxPrice: max,
        shopNames: r.shop_names ?? [],
        discount: max > min ? Math.round((1 - min / max) * 100) : null,
      };
    });

    return { total: parseInt(countRes.rows[0].total, 10), items };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
  const limit = Math.min(48, Math.max(1, parseInt(searchParams.get("limit") ?? "24", 10)));
  const cat = (searchParams.get("cat") ?? "").trim().toLowerCase();
  const q = normalizeSearchText(searchParams.get("q") ?? "");
  const shop = (searchParams.get("shop") ?? "").trim().toLowerCase();
  const sort = parseCatalogSort(searchParams.get("sort"));
  const minRaw = searchParams.get("min");
  const maxRaw = searchParams.get("max");
  const minPrice = minRaw != null && minRaw !== "" ? parseFloat(minRaw) : null;
  const maxPrice = maxRaw != null && maxRaw !== "" ? parseFloat(maxRaw) : null;

  const similar = searchParams.get("similar") === "1";

  if (q) {
    const db = await searchParaFromDb(q, cat, shop, minPrice, maxPrice, sort, page, limit);
    if (db) {
      let dbItems = db.items;
      let dbTotal = db.total;
      if (similar) {
        dbItems = dbItems.filter((p) => p.shopNames.length >= 2);
        dbTotal = dbItems.length;
      }
      const urls = await fetchBestUrls(dbItems.map((p) => p.name));
      const items: ProductWithUrl[] = dbItems.map((p) => ({
        ...p,
        bestUrl: urls.get(p.name.toLowerCase()) ?? null,
      }));
      return NextResponse.json({ total: dbTotal, page, limit, items });
    }
  }

  let data = loadData();

  if (similar) data = data.filter((p) => p.shopNames.length >= 2);
  if (cat) data = data.filter((p) => p.category.toLowerCase().includes(cat));
  if (shop) data = data.filter((p) => p.shopNames.some((s) => s.toLowerCase().includes(shop)));
  if (q) {
    data = data.filter((p) =>
      matchesMemoryProductSearch(
        { name: p.name, brand: p.brand, category: p.category, slug: slugifySearch(p.name) },
        q,
      ),
    );
    data = sortMemorySearchResults(
      data.map((p) => ({ ...p, slug: slugifySearch(p.name) })),
      q,
    );
  }
  if (minPrice != null && Number.isFinite(minPrice)) {
    data = data.filter((p) => p.minPrice >= minPrice);
  }
  if (maxPrice != null && Number.isFinite(maxPrice)) {
    data = data.filter((p) => p.minPrice <= maxPrice);
  }

  if (!q) data = sortCatalogItems(data, sort);

  const total = data.length;
  const slice = data.slice(page * limit, (page + 1) * limit);
  const urls = await fetchBestUrls(slice.map((p) => p.name));
  const items: ProductWithUrl[] = slice.map((p) => ({
    ...p,
    bestUrl: urls.get(p.name.toLowerCase()) ?? null,
  }));

  return NextResponse.json({ total, page, limit, items });
}
