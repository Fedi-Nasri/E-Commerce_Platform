import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { productCoverImageSql } from "@/lib/productImages";

// Compute the cheapest shop for a couffin (basket) of supermarché products.
//
// POST body: { items: [{ id: number, qty: number }] }
//
// Returns, per shop: which basket items it carries, the basket subtotal (sum of
// its prices × qty for items it has), and how many of the basket it covers.
// Shops are ranked by coverage first, then total price — so the winner is the
// cheapest shop that carries the most of your list. Also returns the absolute
// "cheapest mix" (each item at its cheapest shop) for comparison.

export const revalidate = 300;

const pool = new Pool({ connectionString: process.env.ALIMENTATION_DB_URL, max: 5 });

type Body = { items?: { id: number | string; qty?: number }[] };

export async function POST(req: NextRequest) {
  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  // Coerce ids to numbers — pg returns bigint as string, so a basket persisted
  // from the search results may carry string ids. Normalize before matching.
  const items = (body.items ?? [])
    .map((i) => ({ id: Number(i.id), qty: i.qty }))
    .filter((i) => Number.isInteger(i.id) && i.id > 0);
  if (items.length === 0) return NextResponse.json({ shops: [], cheapestMix: null, items: [] });

  const ids = items.map((i) => i.id);
  const qtyById = new Map(items.map((i) => [i.id, Math.max(1, Math.min(99, i.qty ?? 1))]));

  try {
    // every (product, shop, price) for the basket products, + product/shop names
    const { rows } = await pool.query<{
      product_id: number; product_name: string; img: string | null;
      shop_id: number; shop_key: string; shop_name: string; price: string;
    }>(
      `SELECT p.id AS product_id, p.name AS product_name,
              ${productCoverImageSql("p.id")} AS img,
              s.id AS shop_id, s.shop_key, s.name AS shop_name, sp.current_price AS price
       FROM products p
       JOIN shop_prices sp ON sp.product_id = p.id
       JOIN shops s ON s.id = sp.shop_id
       WHERE p.id = ANY($1::bigint[])`,
      [ids]
    );

    // index: product -> list of {shop, price}; shop registry
    const shops = new Map<number, { id: number; key: string; name: string }>();
    const productMeta = new Map<number, { name: string; img: string }>();
    const priceByProductShop = new Map<string, number>(); // `${pid}:${sid}`

    for (const r of rows) {
      const price = parseFloat(r.price);
      if (!Number.isFinite(price)) continue;
      shops.set(r.shop_id, { id: r.shop_id, key: r.shop_key, name: r.shop_name });
      if (!productMeta.has(r.product_id)) productMeta.set(r.product_id, { name: r.product_name, img: r.img ?? "" });
      priceByProductShop.set(`${r.product_id}:${r.shop_id}`, price);
    }

    // resolved basket items (in request order)
    const basketItems = ids.map((id) => {
      const meta = productMeta.get(id);
      return { id, name: meta?.name ?? `#${id}`, img: meta?.img ?? "", qty: qtyById.get(id) ?? 1, found: !!meta };
    });

    // per-shop breakdown
    const shopResults = [...shops.values()].map((shop) => {
      let total = 0;
      let covered = 0;
      const lines = basketItems.map((it) => {
        const price = priceByProductShop.get(`${it.id}:${shop.id}`);
        if (price != null) { covered += 1; total += price * it.qty; }
        return { id: it.id, price: price ?? null };
      });
      return {
        shopKey: shop.key,
        shop: shop.name,
        total: Math.round(total * 1000) / 1000,
        covered,
        totalItems: basketItems.length,
        lines,
      };
    });

    // rank: most coverage first, then cheapest total
    shopResults.sort((a, b) => b.covered - a.covered || a.total - b.total);

    // cheapest mix: each item at its cheapest shop
    let mixTotal = 0;
    let mixCovered = 0;
    const mix = basketItems.map((it) => {
      let best: { shop: string; price: number } | null = null;
      for (const shop of shops.values()) {
        const price = priceByProductShop.get(`${it.id}:${shop.id}`);
        if (price != null && (best == null || price < best.price)) best = { shop: shop.name, price };
      }
      if (best) { mixCovered += 1; mixTotal += best.price * it.qty; }
      return { id: it.id, name: it.name, qty: it.qty, shop: best?.shop ?? null, price: best?.price ?? null };
    });

    return NextResponse.json({
      items: basketItems,
      shops: shopResults,
      cheapestMix: { total: Math.round(mixTotal * 1000) / 1000, covered: mixCovered, totalItems: basketItems.length, lines: mix },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
