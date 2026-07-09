import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { alimentPool, catalogPool, paraPool, retailPool } from "@/lib/db";

// The frontend sends the auth-service access token (HS256, signed with the same
// JWT_SECRET the backend uses) as `Authorization: Bearer <token>`. We verify it
// locally to identify the user — no round-trip to the backend needed.
//
// The live auth service signs `{ userId, email }` (Mongo _id). We also accept
// `sub` for forward-compat with the Postgres-style gateway token.
type JwtPayload = { userId?: string; sub?: string; email?: string; role?: string };

function verify(req: NextRequest): JwtPayload | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    return jwt.verify(token, secret) as JwtPayload;
  } catch {
    return null;
  }
}

export function getUserId(req: NextRequest): string | null {
  const p = verify(req);
  return p?.userId ?? p?.sub ?? null;
}

export function getUserEmail(req: NextRequest): string | null {
  return verify(req)?.email ?? null;
}

// Best (lowest) current price for a product slug across all shops that carry it,
// plus a representative listing for display. Used by alerts + the cron checker.
export type ProductPrice = {
  slug: string;
  name: string;
  brand: string;
  img: string;
  shopSlug: string | null;
  price: number | null;
};

// Try the legacy boutiques catalog first (one row per shop), then fall back
// to the 3 catalog DBs (super / para / retail) which share the same schema:
// products / shops / shop_prices / product_images / brands.
async function resolveFromCatalogDB(slug: string): Promise<ProductPrice | null> {
  const { rows } = await catalogPool().query(
    `SELECT p.slug, p.name, p.brand, p.image, p.price, s.slug AS shop_slug
     FROM products p
     JOIN shops s ON s.id = p.shop_id
     WHERE p.slug = $1
     ORDER BY p.price ASC NULLS LAST
     LIMIT 1`,
    [slug]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    slug: r.slug,
    name: r.name,
    brand: r.brand ?? "",
    img: r.image ?? "",
    shopSlug: r.shop_slug ?? null,
    price: r.price != null ? parseFloat(r.price) : null,
  };
}

async function resolveFromCatalog3DB(
  pool: ReturnType<typeof catalogPool>,
  slug: string
): Promise<ProductPrice | null> {
  try {
    const { rows } = await pool.query(
      `SELECT p.slug,
              p.name,
              COALESCE(b.name, '') AS brand,
              (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY id LIMIT 1) AS image,
              MIN(sp.current_price) AS price,
              (
                SELECT s.slug FROM shop_prices sp2
                JOIN shops s ON s.id = sp2.shop_id
                WHERE sp2.product_id = p.id AND sp2.current_price > 0
                ORDER BY sp2.current_price ASC LIMIT 1
              ) AS shop_slug
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN shop_prices sp ON sp.product_id = p.id AND sp.current_price > 0
       WHERE p.slug = $1 AND p.status = 'active'
       GROUP BY p.id, p.name, b.name
       LIMIT 1`,
      [slug]
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      slug: r.slug,
      name: r.name,
      brand: r.brand ?? "",
      img: r.image ?? "",
      shopSlug: r.shop_slug ?? null,
      price: r.price != null ? parseFloat(r.price) : null,
    };
  } catch {
    return null;
  }
}

export async function resolveProductPrice(slug: string): Promise<ProductPrice | null> {
  // Boutiques catalog (legacy "one row per shop" schema)
  const fromCatalog = await resolveFromCatalogDB(slug);
  if (fromCatalog) return fromCatalog;
  // Supermarché / Parapharmacie / Magasins — same shared schema, different DBs
  for (const pool of [alimentPool(), paraPool(), retailPool()]) {
    const hit = await resolveFromCatalog3DB(pool, slug);
    if (hit) return hit;
  }
  return null;
}
