import { NextRequest, NextResponse } from "next/server";
import { alimentPool, paraPool, retailPool } from "@/lib/db";
import {
  normalizeSearchText,
  rankSearchResults,
  searchProductsInPool,
  type SearchProduct,
} from "@/lib/productSearch";

export const revalidate = 300;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = normalizeSearchText(searchParams.get("q") ?? "");
  const limit = Math.min(60, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const perSource = Math.max(8, Math.ceil(limit / 3));

  try {
    const [retailItems, paraItems, superItems] = await Promise.all([
      searchProductsInPool(retailPool(), "retail", q, perSource),
      searchProductsInPool(paraPool(), "para", q, perSource),
      searchProductsInPool(alimentPool(), "super", q, perSource),
    ]);

    const seen = new Set<string>();
    const merged: SearchProduct[] = [];
    for (const item of [...retailItems, ...paraItems, ...superItems]) {
      const key = `${item.source}:${item.slug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }

    const items = (q ? rankSearchResults(merged, q) : merged).slice(0, limit);
    return NextResponse.json({ total: items.length, items });
  } catch (err) {
    return NextResponse.json({ error: String(err), items: [] }, { status: 500 });
  }
}
