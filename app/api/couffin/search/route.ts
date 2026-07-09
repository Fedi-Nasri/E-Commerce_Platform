import { NextRequest, NextResponse } from "next/server";
import { alimentPool } from "@/lib/db";
import { appendProductSearch, normalizeSearchText } from "@/lib/productSearch";
import { productCoverImageSql } from "@/lib/productImages";
import { foodTopCategorySqlWhere, isFoodCategoryName } from "@/lib/couffinFoodFilter";

// Search supermarché products to add to the couffin.
// Filters out non-food / non-basket products (electronics, apparel, cosmetics,
// etc.) by joining top_categories and applying an exclusion whitelist.

export const revalidate = 300;

export async function GET(req: NextRequest) {
  const q = normalizeSearchText(req.nextUrl.searchParams.get("q") ?? "");
  const limit = Math.min(20, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10)));
  if (q.length < 2) return NextResponse.json({ items: [] });

  try {
    const pool = alimentPool();
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    const relevanceOrder = appendProductSearch(q, conditions, params);

    // Only keep products whose top_category is a couffin/food/consumable category.
    // We require at least one linked top_category that is NOT in the excluded list.
    conditions.push(`EXISTS (
      SELECT 1 FROM product_subcategories psc
      JOIN subcategories sc ON sc.id = psc.subcategory_id
      JOIN low_categories lc ON lc.id = sc.low_category_id
      JOIN top_categories tc ON tc.id = lc.top_category_id
      WHERE psc.product_id = p.id
        AND (${foodTopCategorySqlWhere("tc.name")})
    )`);

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderBy = relevanceOrder ?? "COUNT(DISTINCT sp.shop_id) DESC, p.id";

    const { rows } = await pool.query<{
      id: number;
      name: string;
      brand: string;
      img: string | null;
      min_price: string;
      max_price: string;
      shop_count: string;
      top_category: string | null;
    }>(
      `SELECT p.id, p.name, COALESCE(b.name,'') AS brand,
              ${productCoverImageSql("p.id")} AS img,
              MIN(sp.current_price) AS min_price,
              MAX(sp.current_price) AS max_price,
              COUNT(DISTINCT sp.shop_id) AS shop_count,
              (
                SELECT tc.name FROM product_subcategories psc
                JOIN subcategories sc ON sc.id = psc.subcategory_id
                JOIN low_categories lc ON lc.id = sc.low_category_id
                JOIN top_categories tc ON tc.id = lc.top_category_id
                WHERE psc.product_id = p.id
                LIMIT 1
              ) AS top_category
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       JOIN shop_prices sp ON sp.product_id = p.id
       ${where}
       GROUP BY p.id, p.name, b.name
       ORDER BY ${orderBy}
       LIMIT $${params.length + 1}`,
      [...params, limit],
    );

    const items = rows
      // Safety net: even if the DB-level filter missed a category, drop non-food
      // in the app layer.
      .filter((r) => isFoodCategoryName(r.top_category))
      .map((r) => ({
        id: Number(r.id),
        name: r.name,
        brand: r.brand,
        img: r.img ?? "",
        minPrice: parseFloat(r.min_price) || 0,
        maxPrice: parseFloat(r.max_price) || 0,
        shopCount: parseInt(r.shop_count, 10) || 0,
      }));
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: String(err), items: [] }, { status: 500 });
  }
}
