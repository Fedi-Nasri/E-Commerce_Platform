import { NextResponse } from "next/server";
import { alimentPool } from "@/lib/db";

// GET /api/similar-count
// Counts products present in at least 2 shops (via shop_prices).

export const revalidate = 300;

export async function GET() {
  try {
    const pool = alimentPool();

    const res = await pool.query<{ total: string }>(`
      SELECT COUNT(*)::text AS total
      FROM (
        SELECT product_id
        FROM shop_prices
        GROUP BY product_id
        HAVING COUNT(DISTINCT shop_id) >= 2
      ) sub
    `);

    const total = parseInt(res.rows[0]?.total ?? "0", 10);
    return NextResponse.json({ total }, { headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=600" } });
  } catch (err) {
    return NextResponse.json({ total: 0, error: String(err) }, { status: 500 });
  }
}
