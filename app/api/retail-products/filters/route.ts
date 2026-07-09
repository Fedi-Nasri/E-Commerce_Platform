import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import {
  buildRetailContextWhere,
  parseRetailListFilters,
  RETAIL_FILTER_SPECS,
} from "@/lib/retailProductQuery";

export const revalidate = 300;

const pool = new Pool({ connectionString: process.env.RETAIL_DB_URL, max: 4 });

const CONTEXT_JOINS = `
  FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN product_subcategories psc ON psc.product_id = p.id
  LEFT JOIN subcategories sc ON sc.id = psc.subcategory_id
  LEFT JOIN low_categories lc ON lc.id = sc.low_category_id
  LEFT JOIN top_categories tc ON tc.id = lc.top_category_id
`;

export async function GET(req: NextRequest) {
  const filters = parseRetailListFilters(req.nextUrl.searchParams);
  const { where, params } = buildRetailContextWhere(filters);

  const client = await pool.connect();
  try {
    const brandWhere = where
      ? `${where} AND b.name IS NOT NULL`
      : "WHERE b.name IS NOT NULL";

    const priceRes = await client.query(
      `SELECT
         COALESCE(MIN(sub.min_price), 0) AS min_price,
         COALESCE(MAX(sub.max_price), 0) AS max_price
       FROM (
         SELECT p.id, MIN(sp.current_price) AS min_price, MAX(sp.current_price) AS max_price
         ${CONTEXT_JOINS}
         LEFT JOIN shop_prices sp ON sp.product_id = p.id
         ${where}
         GROUP BY p.id
       ) sub`,
      params,
    );

    const brandsRes = await client.query(
      `SELECT b.name, COUNT(DISTINCT p.id)::int AS cnt
       ${CONTEXT_JOINS}
       ${brandWhere}
       GROUP BY b.name
       ORDER BY cnt DESC, b.name ASC
       LIMIT 24`,
      params,
    );

    const specResults = await Promise.all(
      RETAIL_FILTER_SPECS.map((spec) => {
        const specWhere = where
          ? `${where} AND ps.spec_key = ANY($${params.length + 1}::text[])`
          : `WHERE ps.spec_key = ANY($1::text[])`;
        const specParams = where ? [...params, spec.keys] : [spec.keys];
        return client.query(
          `SELECT ps.spec_value AS value, COUNT(DISTINCT p.id)::int AS cnt
           ${CONTEXT_JOINS}
           JOIN product_specs ps ON ps.product_id = p.id
           ${specWhere}
           GROUP BY ps.spec_value
           ORDER BY cnt DESC, ps.spec_value ASC
           LIMIT 12`,
          specParams,
        );
      }),
    );

    const minPrice = parseFloat(priceRes.rows[0]?.min_price ?? "0") || 0;
    const maxPrice = parseFloat(priceRes.rows[0]?.max_price ?? "0") || 0;

    return NextResponse.json({
      price: {
        min: Math.floor(minPrice),
        max: Math.ceil(maxPrice),
      },
      brands: brandsRes.rows.map((r) => ({ name: r.name, count: r.cnt })),
      specs: Object.fromEntries(
        RETAIL_FILTER_SPECS.map((spec, i) => [
          spec.id,
          {
            label: spec.label,
            param: spec.param,
            values: specResults[i].rows.map((r) => ({ value: r.value, count: r.cnt })),
          },
        ]),
      ),
    });
  } catch (err) {
    console.error("[retail-products/filters]", err);
    return NextResponse.json(
      { price: { min: 0, max: 0 }, brands: [], specs: {} },
      { status: 200 },
    );
  } finally {
    client.release();
  }
}
