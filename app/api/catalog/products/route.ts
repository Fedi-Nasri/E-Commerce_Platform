import { NextRequest, NextResponse } from "next/server";
import { catalogPool } from "@/lib/db";
import { appendCatalogShopSearch, normalizeSearchText } from "@/lib/productSearch";
import { localShopLogo } from "@/lib/shopLogos";

// Pulls the last valid image URL out of a possibly-corrupted string.
// The migration imported some rows where the scraper concatenated two URLs with
// runs of whitespace (e.g. "https://agora.tn/fr/   https://agora.tn/fr/49281...jpg\n   ").
// We grab the trailing usable URL and trim.

export const revalidate = 300;

function sanitizeImage(raw: string | null | undefined): string {
  if (!raw) return "";
  const matches = String(raw).match(/https?:\/\/\S+\.(?:jpg|jpeg|png|webp|gif|avif)(?:\?[^\s"']*)?/gi);
  if (matches && matches.length) return matches[matches.length - 1];
  // Fallback: trim, drop everything past the first whitespace
  return String(raw).trim().split(/\s+/).pop() ?? "";
}

function sanitizeText(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw)
    .replace(/chevron_right/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// GET /api/catalog/products?shop=tunisianet&page=0&limit=24&q=...&cat=...
// Per-shop catalog browse with search + top_category filter + pagination.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const shop  = (searchParams.get("shop") ?? "").trim().toLowerCase();
  const page  = Math.max(0, parseInt(searchParams.get("page")  ?? "0", 10));
  const limit = Math.min(48, Math.max(1, parseInt(searchParams.get("limit") ?? "24", 10)));
  const q     = normalizeSearchText(searchParams.get("q")   ?? "");
  const cat   = (searchParams.get("cat") ?? "").trim();

  if (!shop) return NextResponse.json({ error: "shop required" }, { status: 400 });

  try {
    const pool = catalogPool();
    const shopRes = await pool.query<{ id: number; name: string; slug: string; shop_key: string; logo_url: string | null }>(
      `SELECT id, name, slug, shop_key, logo_url FROM shops WHERE slug = $1 OR shop_key = $1 LIMIT 1`,
      [shop]
    );
    if (!shopRes.rows.length) return NextResponse.json({ error: "shop not found" }, { status: 404 });
    const shopId = shopRes.rows[0].id;

    const where: string[] = ["p.shop_id = $1"];
    const params: (string | number)[] = [shopId];
    const searchOrder = q ? appendCatalogShopSearch(q, where, params) : null;
    if (cat) {
      params.push(cat);
      where.push(`p.top_category = $${params.length}`);
    }
    const whereSql = `WHERE ${where.join(" AND ")}`;
    const orderSql = searchOrder
      ? `${searchOrder}, (p.image IS NOT NULL) DESC, p.id`
      : `(p.image IS NOT NULL) DESC, p.id`;
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const [countRes, itemsRes, catsRes] = await Promise.all([
      pool.query<{ total: string }>(`SELECT COUNT(*) AS total FROM products p ${whereSql}`, params),
      pool.query(
        `SELECT p.slug, p.name, p.brand, p.image, p.price, p.old_price, p.available,
                p.top_category, p.low_category,
                pd.images AS extra_images
         FROM products p
         LEFT JOIN product_details pd ON pd.product_id = p.id
         ${whereSql}
         ORDER BY ${orderSql}
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        [...params, limit, page * limit]
      ),
      pool.query<{ top_category: string; n: string }>(
        `SELECT top_category, COUNT(*) n FROM products
         WHERE shop_id = $1 AND top_category IS NOT NULL
         GROUP BY top_category ORDER BY n DESC LIMIT 40`,
        [shopId]
      ),
    ]);

    const items = itemsRes.rows.map(r => {
      const price = r.price != null ? parseFloat(r.price) : null;
      const old   = r.old_price != null ? parseFloat(r.old_price) : null;
      const primary = sanitizeImage(r.image);
      const extras = Array.isArray(r.extra_images)
        ? r.extra_images.map((x: string) => sanitizeImage(x)).filter(Boolean)
        : [];
      // Merge into a deduped list, primary first
      const seen = new Set<string>();
      const images: string[] = [];
      if (primary) { images.push(primary); seen.add(primary); }
      for (const u of extras) {
        if (u && !seen.has(u)) { images.push(u); seen.add(u); }
      }
      return {
        slug: r.slug,
        name: sanitizeText(r.name),
        brand: sanitizeText(r.brand),
        img: images[0] ?? "",
        img2: images[1] ?? null,
        images,
        price,
        oldPrice: old,
        available: r.available,
        category: sanitizeText(r.top_category),
        discount: old && price && old > price ? Math.round((1 - price / old) * 100) : null,
      };
    });

    return NextResponse.json({
      shop: shopRes.rows[0].name,
      logo: shopRes.rows[0].logo_url || localShopLogo(shopRes.rows[0].slug, shopRes.rows[0].shop_key),
      total: parseInt(countRes.rows[0].total, 10),
      page, limit, items,
      categories: catsRes.rows.map(c => ({ name: sanitizeText(c.top_category), count: parseInt(c.n, 10) })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
