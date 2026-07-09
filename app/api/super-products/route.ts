import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { catalogSortSql, parseCatalogSort } from "@/lib/catalogFilters";
import { appendProductSearch, normalizeSearchText } from "@/lib/productSearch";
import { productCoverImageSql } from "@/lib/productImages";


export const revalidate = 300;

const pool = new Pool({
  connectionString: process.env.ALIMENTATION_DB_URL,
  max: 5,
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page  = Math.max(0, parseInt(searchParams.get("page")  ?? "0", 10));
  const limit = Math.min(48, Math.max(1, parseInt(searchParams.get("limit") ?? "24", 10)));
  const q     = normalizeSearchText(searchParams.get("q") ?? "");
  const shop  = (searchParams.get("shop") ?? "").trim().toLowerCase();
  const similarOnly = ["1", "true", "yes"].includes((searchParams.get("similar") ?? "").trim().toLowerCase());
  const sort = parseCatalogSort(searchParams.get("sort"));
  const minRaw = searchParams.get("min");
  const maxRaw = searchParams.get("max");
  const minPrice = minRaw != null && minRaw !== "" ? parseFloat(minRaw) : null;
  const maxPrice = maxRaw != null && maxRaw !== "" ? parseFloat(maxRaw) : null;

  const conditions: string[] = [];
  const having: string[] = [];
  const params: (string | number)[] = [];

  let relevanceOrder: string | null = null;
  if (q) {
    relevanceOrder = appendProductSearch(q, conditions, params);
  }
  if (shop) {
    params.push(shop);
    const shopIdx = params.length;
    if (similarOnly) {
      conditions.push(`EXISTS (
        SELECT 1
        FROM shop_prices sp_shop
        JOIN shops s_shop ON s_shop.id = sp_shop.shop_id
        WHERE sp_shop.product_id = p.id
          AND s_shop.shop_key = $${shopIdx}
      )`);
    } else {
      conditions.push(`s.shop_key = $${shopIdx}`);
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  if (similarOnly) having.push("COUNT(DISTINCT s.id) > 1");
  if (minPrice != null && Number.isFinite(minPrice)) {
    params.push(minPrice);
    having.push(`MIN(sp.current_price) >= $${params.length}`);
  }
  if (maxPrice != null && Number.isFinite(maxPrice)) {
    params.push(maxPrice);
    having.push(`MIN(sp.current_price) <= $${params.length}`);
  }
  const havingClause = having.length ? `HAVING ${having.join(" AND ")}` : "";
  const orderBy = relevanceOrder ? `${relevanceOrder}, ${catalogSortSql(sort)}` : catalogSortSql(sort);
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;

  const countSql = `
    SELECT COUNT(*) AS total
    FROM (
      SELECT p.id
      FROM products p
      LEFT JOIN brands b ON b.id = p.brand_id
      JOIN shop_prices sp ON sp.product_id = p.id
      JOIN shops s ON s.id = sp.shop_id
      ${where}
      GROUP BY p.id
      ${havingClause}
    ) matches
  `;

  const itemsSql = `
    SELECT
      p.id,
      p.name,
      COALESCE(b.name, '') AS brand,
      MIN(sp.current_price) AS min_price,
      MAX(sp.current_price) AS max_price,
      ${productCoverImageSql("p.id")} AS img,
      array_agg(DISTINCT s.name ORDER BY s.name) AS shop_names
    FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    JOIN shop_prices sp ON sp.product_id = p.id
    JOIN shops s ON s.id = sp.shop_id
    ${where}
    GROUP BY p.id, p.name, b.name
    ${havingClause}
    ORDER BY ${orderBy}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  try {
    const [countRes, itemsRes] = await Promise.all([
      pool.query(countSql, params),
      pool.query(itemsSql, [...params, limit, page * limit]),
    ]);

    const total = parseInt(countRes.rows[0].total, 10);
    const items = itemsRes.rows.map(r => ({
      name:      r.name,
      brand:     r.brand,
      img:       r.img ?? "",
      minPrice:  parseFloat(r.min_price) || 0,
      maxPrice:  parseFloat(r.max_price) || 0,
      shopNames: r.shop_names ?? [],
      discount:  r.max_price > r.min_price
        ? Math.round((1 - r.min_price / r.max_price) * 100)
        : null,
    }));

    return NextResponse.json({ total, page, limit, similarOnly, items });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
