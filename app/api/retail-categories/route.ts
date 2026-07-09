import { NextResponse } from "next/server";
import { Pool } from "pg";
import { RETAIL_CATEGORY_SLUGS } from "@/lib/retailCategories";


export const revalidate = 300;
export const dynamic = "force-dynamic";

const pool = new Pool({ connectionString: process.env.RETAIL_DB_URL, max: 2 });

type Cat = { id: number; name: string; slug: string; subcategories: { name: string; slug: string }[] };
let cache: Cat[] | null = null;
cache = null;

export async function GET() {
  if (cache) return NextResponse.json({ categories: cache });

  const client = await pool.connect();
  try {
    const res = await client.query(
      `
      SELECT
        tc.id        AS top_id,
        tc.name      AS top_name,
        tc.slug      AS top_slug,
        sc.name      AS sub_name,
        sc.slug      AS sub_slug
      FROM top_categories tc
      LEFT JOIN low_categories lc ON lc.top_category_id = tc.id
      LEFT JOIN subcategories sc ON sc.low_category_id = lc.id
      WHERE EXISTS (
        SELECT 1 FROM product_subcategories psc
        JOIN subcategories sc2 ON sc2.id = psc.subcategory_id
        JOIN low_categories lc2 ON lc2.id = sc2.low_category_id
        WHERE lc2.top_category_id = tc.id
      )
      AND (
        tc.slug = ANY($1::text[])
        OR lc.slug = ANY($1::text[])
        OR sc.slug = ANY($1::text[])
      )
      ORDER BY tc.name ASC, sc.name ASC
    `,
      [RETAIL_CATEGORY_SLUGS],
    );

    const map = new Map<number, Cat>();
    for (const row of res.rows) {
      if (!map.has(row.top_id)) {
        map.set(row.top_id, { id: row.top_id, name: row.top_name, slug: row.top_slug, subcategories: [] });
      }
      if (row.sub_name && row.sub_slug) {
        const entry = map.get(row.top_id)!;
        if (!entry.subcategories.find((s: { slug: string }) => s.slug === row.sub_slug)) {
          entry.subcategories.push({ name: row.sub_name, slug: row.sub_slug });
        }
      }
    }

    cache = [...map.values()];
    return NextResponse.json({ categories: cache });
  } finally {
    client.release();
  }
}
