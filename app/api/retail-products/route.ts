import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import {
  buildRetailProductQuery,
  parseRetailListFilters,
} from "@/lib/retailProductQuery";

const pool = new Pool({ connectionString: process.env.RETAIL_DB_URL, max: 4 });

const TOP_CATEGORY_SLUGS = [
  "accessoires-informatiques", "accessoires-telephonie", "accessoires-gamer",
  "audio-casques-et-haut-parleurs", "batteries-et-chargeurs", "climatisation-et-chauffage",
  "composants", "consoles", "ecrans-et-moniteurs", "encre-et-toner",
  "froid-et-refrigeration", "gros-electromenager", "home-cinema-et-streaming",
  "imprimantes-et-scanners", "jeux-video", "lavage", "manettes",
  "montres-et-objets-connectes", "onduleurs-et-alimentation", "ordinateurs-apple",
  "pc-de-bureau", "pc-de-bureau-gamer", "pc-portables", "pc-portables-gamer",
  "petit-electromenager", "reseaux-serveurs-et-securite", "smartphones",
  "stockage", "tablettes", "televisions", "videoprojecteurs",
  "appareils-photo", "aspirateurs-et-nettoyage", "chaises-et-bureaux-gamer",
  "cuisson", "logiciels", "materiel-point-de-vente", "telephones-classiques",
  "eclairage-et-electricite",
];

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
  const limit = Math.min(48, Math.max(1, parseInt(searchParams.get("limit") ?? "24", 10)));
  const filters = parseRetailListFilters(searchParams);
  const { baseJoins, where, having, params, orderBy } = buildRetailProductQuery(filters);

  const client = await pool.connect();
  try {
    const [countRes, shopCountRes, allShopsRes, allCatsRes] = await Promise.all([
      client.query(
        `SELECT COUNT(*) AS total FROM (
           SELECT p.id
           ${baseJoins}
           ${where}
           GROUP BY p.id
           ${having}
         ) sub`,
        params,
      ),
      client.query(`SELECT COUNT(*) AS cnt FROM shops`),
      client.query(`
        SELECT s.shop_key, s.name
        FROM shops s
        WHERE EXISTS (SELECT 1 FROM shop_prices sp WHERE sp.shop_id = s.id)
        ORDER BY s.name ASC
      `),
      client.query(
        `SELECT tc.id, tc.name, tc.slug
         FROM top_categories tc
         WHERE tc.slug = ANY($1::text[])
         ORDER BY tc.name ASC`,
        [TOP_CATEGORY_SLUGS],
      ),
    ]);

    const total = parseInt(countRes.rows[0].total, 10);
    const shopCount = parseInt(shopCountRes.rows[0].cnt, 10);
    const allShops = allShopsRes.rows.map((r) => ({ key: r.shop_key, name: r.name }));
    const allCats = allCatsRes.rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug }));

    const listParams = [...params, limit, page * limit];
    const dataRes = await client.query(
      `SELECT
         p.id, p.name, p.slug, p.is_matched,
         b.name AS brand,
         tc.name AS category,
         MIN(sp.current_price) AS min_price,
         MAX(sp.current_price) AS max_price,
         array_agg(DISTINCT s.shop_key ORDER BY s.shop_key) AS shop_keys,
         (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.image_url NOT ILIKE '%yatoo.com.tn%' ORDER BY pi.id ASC OFFSET 1 LIMIT 1) AS img2,
         (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.image_url NOT ILIKE '%yatoo.com.tn%' ORDER BY pi.id ASC LIMIT 1) AS img1
       ${baseJoins}
       ${where}
       GROUP BY p.id, p.name, p.slug, p.is_matched, b.name, tc.name
       ${having}
       ORDER BY ${orderBy}
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    const items = dataRes.rows.map((r) => ({
      name: r.name,
      slug: r.slug,
      brand: r.brand ?? "",
      category: r.category ?? "",
      img: r.img2 ?? r.img1 ?? null,
      minPrice: r.min_price ? parseFloat(r.min_price) : null,
      maxPrice: r.max_price ? parseFloat(r.max_price) : null,
      shopNames: r.shop_keys ?? [],
      isMatched: r.is_matched,
      discount: null,
    }));

    return NextResponse.json({ total, page, limit, items, shopCount, allShops, allCats });
  } finally {
    client.release();
  }
}
