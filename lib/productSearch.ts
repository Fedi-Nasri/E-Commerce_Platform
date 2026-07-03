import { Pool } from "pg";
import { productCoverImageSql } from "@/lib/productImages";

export type SearchProduct = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  img: string;
  price: number;
  oldPrice: number;
  store: string;
  rating: number;
  source: "para" | "retail" | "super";
};

const SKU_SPEC_KEYS = ["gtin", "sku", "reference", "normalized_sku", "ean", "barcode"];

export { SKU_SPEC_KEYS };

export function normalizeSearchText(q: string): string {
  return q.trim().replace(/\s+/g, " ");
}

export function slugifySearch(q: string): string {
  return normalizeSearchText(q)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function productSearchMatchSql(
  qIdx: number,
  slugIdx: number,
  likeIdx: number,
  skuKeysIdx: number,
  prefixIdx: number,
): string {
  return `(
    lower(regexp_replace(trim(p.name), '\\s+', ' ', 'g')) = $${qIdx}
    OR lower(coalesce(p.source_product_id, '')) = $${qIdx}
    OR lower(p.slug) = $${slugIdx}
    OR lower(p.name) LIKE $${likeIdx}
    OR lower(p.name) LIKE $${prefixIdx}
    OR lower(coalesce(b.name, '')) LIKE $${likeIdx}
    OR lower(coalesce(p.source_product_id, '')) LIKE $${likeIdx}
    OR EXISTS (
      SELECT 1 FROM product_specs ps_q
      WHERE ps_q.product_id = p.id
        AND (
          lower(ps_q.spec_value) = $${qIdx}
          OR (ps_q.spec_key = ANY($${skuKeysIdx}::text[]) AND lower(ps_q.spec_value) LIKE $${likeIdx})
        )
    )
  )`;
}

function productTokenMatchSql(tokenIdx: number): string {
  return `(
    lower(p.name) LIKE $${tokenIdx}
    OR lower(coalesce(b.name, '')) LIKE $${tokenIdx}
    OR lower(coalesce(p.source_product_id, '')) LIKE $${tokenIdx}
    OR EXISTS (
      SELECT 1 FROM product_specs ps_t
      WHERE ps_t.product_id = p.id AND lower(ps_t.spec_value) LIKE $${tokenIdx}
    )
  )`;
}

/** Push unified product search params; returns ORDER BY relevance expression or null. */
export function appendProductSearch(
  rawQuery: string,
  conditions: string[],
  params: (string | number | boolean | string[])[],
): string | null {
  const q = normalizeSearchText(rawQuery);
  if (!q) return null;

  const qLower = q.toLowerCase();
  const slugQ = slugifySearch(q);
  const like = `%${qLower}%`;
  const prefix = `${qLower}%`;
  const tokens = qLower.split(" ").filter((t) => t.length > 0);

  params.push(qLower, slugQ, like, SKU_SPEC_KEYS, prefix);
  const qIdx = params.length - 4;
  const slugIdx = params.length - 3;
  const likeIdx = params.length - 2;
  const skuKeysIdx = params.length - 1;
  const prefixIdx = params.length;

  // Indices des params "%token%" (réutilisés pour la clause WHERE ET le score,
  // pour ne PAS pousser de params uniquement utilisés dans l'ORDER BY — sinon
  // la requête COUNT (qui n'a pas d'ORDER BY) échoue avec un mismatch de params).
  const tokenParamIdx: number[] = [];
  if (tokens.length <= 1) {
    conditions.push(productSearchMatchSql(qIdx, slugIdx, likeIdx, skuKeysIdx, prefixIdx));
  } else {
    const tokenClauses = tokens.map((token) => {
      params.push(`%${token}%`);
      tokenParamIdx.push(params.length);
      return productTokenMatchSql(params.length);
    });
    conditions.push(`(
      ${productSearchMatchSql(qIdx, slugIdx, likeIdx, skuKeysIdx, prefixIdx)}
      OR (${tokenClauses.join(" AND ")})
    )`);
  }

  // Le score de tokens réutilise les indices déjà poussés (aucun param en plus).
  // Pour une requête à 1 seul mot, PAS de terme de score (sinon "(0) DESC" est
  // interprété par Postgres comme la position de colonne 0 → erreur).
  const tokenScoreParts = tokenParamIdx.map(
    (tIdx) => `CASE WHEN lower(p.name) LIKE $${tIdx} THEN 1 ELSE 0 END`,
  );
  const tokenScoreOrder =
    tokens.length > 1 ? `MAX(${tokenScoreParts.join(" + ")}) DESC,` : "";

  return `
    MIN(
      CASE
        WHEN lower(regexp_replace(trim(p.name), '\\s+', ' ', 'g')) = $${qIdx} THEN 0
        WHEN lower(coalesce(p.source_product_id, '')) = $${qIdx} THEN 1
        WHEN lower(p.slug) = $${slugIdx} THEN 2
        WHEN lower(p.name) LIKE $${likeIdx} THEN 3
        WHEN EXISTS (
          SELECT 1 FROM product_specs ps_r
          WHERE ps_r.product_id = p.id AND lower(ps_r.spec_value) = $${qIdx}
        ) THEN 4
        WHEN lower(p.name) LIKE $${prefixIdx} THEN 5
        WHEN lower(coalesce(b.name, '')) LIKE $${likeIdx} THEN 6
        WHEN lower(coalesce(p.source_product_id, '')) LIKE $${likeIdx} THEN 7
        WHEN EXISTS (
          SELECT 1 FROM product_specs ps_r
          WHERE ps_r.product_id = p.id
            AND ps_r.spec_key = ANY($${skuKeysIdx}::text[])
            AND lower(ps_r.spec_value) LIKE $${likeIdx}
        ) THEN 8
        ELSE 9
      END
    ) ASC,
    ${tokenScoreOrder}
    length(p.name) ASC,
    p.name ASC
  `;
}

/** Catalog DB (boutiques) — title, slug, source id, SKU/barcode in product_details. */
export function appendCatalogShopSearch(
  rawQuery: string,
  where: string[],
  params: (string | number)[],
): string | null {
  const q = normalizeSearchText(rawQuery);
  if (!q) return null;

  const qLower = q.toLowerCase();
  const slugQ = slugifySearch(q);
  const like = `%${qLower}%`;
  const prefix = `${qLower}%`;

  params.push(qLower, slugQ, like, prefix);
  const qIdx = params.length - 3;
  const slugIdx = params.length - 2;
  const likeIdx = params.length - 1;
  const prefixIdx = params.length;

  where.push(`(
    lower(regexp_replace(trim(p.name), '\\s+', ' ', 'g')) = $${qIdx}
    OR lower(p.slug) = $${slugIdx}
    OR lower(coalesce(p.source_product_id, '')) = $${qIdx}
    OR lower(p.name) LIKE $${likeIdx}
    OR lower(coalesce(p.brand, '')) LIKE $${likeIdx}
    OR lower(coalesce(p.source_product_id, '')) LIKE $${likeIdx}
    OR EXISTS (
      SELECT 1 FROM product_details pd
      WHERE pd.product_id = p.id
        AND (
          lower(coalesce(pd.sku, '')) = $${qIdx}
          OR lower(coalesce(pd.barcode, '')) = $${qIdx}
          OR lower(coalesce(pd.sku, '')) LIKE $${likeIdx}
          OR lower(coalesce(pd.barcode, '')) LIKE $${likeIdx}
        )
    )
  )`);

  return `
    CASE
      WHEN lower(regexp_replace(trim(p.name), '\\s+', ' ', 'g')) = $${qIdx} THEN 0
      WHEN lower(p.slug) = $${slugIdx} THEN 1
      WHEN lower(coalesce(p.source_product_id, '')) = $${qIdx} THEN 2
      WHEN EXISTS (
        SELECT 1 FROM product_details pd
        WHERE pd.product_id = p.id
          AND (lower(coalesce(pd.sku, '')) = $${qIdx} OR lower(coalesce(pd.barcode, '')) = $${qIdx})
      ) THEN 3
      WHEN lower(p.name) LIKE $${prefixIdx} THEN 4
      WHEN lower(p.name) LIKE $${likeIdx} THEN 5
      WHEN lower(coalesce(p.brand, '')) LIKE $${likeIdx} THEN 6
      ELSE 7
    END ASC,
    length(p.name) ASC,
    p.name ASC
  `;
}

export type MemorySearchable = {
  name: string;
  brand?: string;
  category?: string;
  slug?: string;
  sourceId?: string;
};

export function matchesMemoryProductSearch(item: MemorySearchable, rawQuery: string): boolean {
  const q = normalizeSearchText(rawQuery).toLowerCase();
  if (!q) return true;

  const name = normalizeSearchText(item.name).toLowerCase();
  const brand = (item.brand ?? "").toLowerCase();
  const slug = item.slug ?? slugifySearch(item.name);
  const sourceId = (item.sourceId ?? "").toLowerCase();

  if (name === q || slug === slugifySearch(rawQuery) || sourceId === q) return true;
  if (name.includes(q) || brand.includes(q) || sourceId.includes(q)) return true;
  return false;
}

export function scoreMemoryProductSearch(item: MemorySearchable, rawQuery: string): number {
  const q = normalizeSearchText(rawQuery).toLowerCase();
  const name = normalizeSearchText(item.name).toLowerCase();
  const brand = (item.brand ?? "").toLowerCase();
  const slug = item.slug ?? slugifySearch(item.name);
  const sourceId = (item.sourceId ?? "").toLowerCase();
  const slugQ = slugifySearch(rawQuery);

  if (name === q) return 0;
  if (sourceId === q) return 1;
  if (slug === slugQ) return 2;
  if (name.startsWith(q)) return 3;
  if (name.includes(q)) return 4;
  if (brand.includes(q)) return 5;
  if (sourceId.includes(q)) return 6;
  return 99;
}

export function sortMemorySearchResults<T extends MemorySearchable>(items: T[], rawQuery: string): T[] {
  const q = normalizeSearchText(rawQuery);
  if (!q) return items;
  return [...items].sort(
    (a, b) =>
      scoreMemoryProductSearch(a, q) - scoreMemoryProductSearch(b, q) ||
      a.name.length - b.name.length ||
      a.name.localeCompare(b.name, "fr"),
  );
}

function coverImageSql(source: "para" | "retail" | "super"): string {
  if (source === "super") return productCoverImageSql("p.id");
  return `(SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.id ASC LIMIT 1)`;
}

type DbRow = {
  id: number;
  name: string;
  slug: string;
  brand: string;
  min_price: string;
  max_price: string;
  img: string | null;
  shop_name: string | null;
};

function mapRow(row: DbRow, source: "para" | "retail" | "super"): SearchProduct {
  const min = parseFloat(row.min_price) || 0;
  const max = parseFloat(row.max_price) || min;
  return {
    id: `${source}-${row.slug}-${row.id}`,
    slug: row.slug,
    name: row.name,
    brand: row.brand || "",
    img: row.img || "",
    price: min,
    oldPrice: max,
    store: row.shop_name || "",
    rating: 4.5,
    source,
  };
}

export async function searchProductsInPool(
  pool: Pool,
  source: "para" | "retail" | "super",
  rawQuery: string,
  limit: number,
): Promise<SearchProduct[]> {
  const q = normalizeSearchText(rawQuery);
  const imgSql = coverImageSql(source);

  if (!q) {
    const { rows } = await pool.query<DbRow>(
      `
      SELECT
        p.id, p.name, p.slug,
        COALESCE(b.name, '') AS brand,
        MIN(sp.current_price) AS min_price,
        MAX(sp.current_price) AS max_price,
        ${imgSql} AS img,
        (array_agg(DISTINCT s.name ORDER BY s.name))[1] AS shop_name
      FROM products p
      LEFT JOIN brands b ON b.id = p.brand_id
      JOIN shop_prices sp ON sp.product_id = p.id
      JOIN shops s ON s.id = sp.shop_id
      GROUP BY p.id, p.name, p.slug, b.name
      ORDER BY COUNT(DISTINCT s.id) DESC, p.id DESC
      LIMIT $1
      `,
      [limit],
    );
    return rows.map((r) => mapRow(r, source));
  }

  const qLower = q.toLowerCase();
  const slugQ = slugifySearch(q);
  const like = `%${qLower}%`;
  const prefix = `${qLower}%`;

  const { rows } = await pool.query<DbRow>(
    `
    SELECT
      p.id, p.name, p.slug,
      COALESCE(b.name, '') AS brand,
      MIN(sp.current_price) AS min_price,
      MAX(sp.current_price) AS max_price,
      ${imgSql} AS img,
      (array_agg(DISTINCT s.name ORDER BY s.name))[1] AS shop_name,
      MIN(
        CASE
          WHEN lower(regexp_replace(trim(p.name), '\\s+', ' ', 'g')) = $1 THEN 0
          WHEN lower(coalesce(p.source_product_id, '')) = $1 THEN 1
          WHEN lower(p.slug) = $2 THEN 2
          WHEN EXISTS (
            SELECT 1 FROM product_specs ps
            WHERE ps.product_id = p.id
              AND lower(ps.spec_value) = $1
          ) THEN 3
          WHEN lower(p.name) LIKE $5 THEN 4
          WHEN lower(p.name) LIKE $3 THEN 5
          WHEN lower(coalesce(b.name, '')) LIKE $3 THEN 6
          WHEN lower(coalesce(p.source_product_id, '')) LIKE $3 THEN 7
          WHEN EXISTS (
            SELECT 1 FROM product_specs ps
            WHERE ps.product_id = p.id
              AND ps.spec_key = ANY($4::text[])
              AND lower(ps.spec_value) LIKE $3
          ) THEN 8
          ELSE 9
        END
      ) AS relevance
    FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    JOIN shop_prices sp ON sp.product_id = p.id
    JOIN shops s ON s.id = sp.shop_id
    WHERE (
      lower(regexp_replace(trim(p.name), '\\s+', ' ', 'g')) = $1
      OR lower(coalesce(p.source_product_id, '')) = $1
      OR lower(p.slug) = $2
      OR lower(p.name) LIKE $3
      OR lower(coalesce(b.name, '')) LIKE $3
      OR lower(coalesce(p.source_product_id, '')) LIKE $3
      OR EXISTS (
        SELECT 1 FROM product_specs ps
        WHERE ps.product_id = p.id
          AND (
            lower(ps.spec_value) = $1
            OR (ps.spec_key = ANY($4::text[]) AND lower(ps.spec_value) LIKE $3)
          )
      )
    )
    GROUP BY p.id, p.name, p.slug, b.name
    ORDER BY relevance ASC, length(p.name) ASC, p.name ASC
    LIMIT $6
    `,
    [qLower, slugQ, like, SKU_SPEC_KEYS, prefix, limit],
  );

  return rows.map((r) => mapRow(r, source));
}

export function rankSearchResults(items: SearchProduct[], rawQuery: string): SearchProduct[] {
  const q = normalizeSearchText(rawQuery).toLowerCase();
  const slugQ = slugifySearch(rawQuery);

  const score = (p: SearchProduct) => {
    const name = normalizeSearchText(p.name).toLowerCase();
    if (name === q) return 0;
    if (p.slug === slugQ) return 1;
    if (name.startsWith(q)) return 2;
    if (name.includes(q)) return 3;
    if ((p.brand ?? "").toLowerCase().includes(q)) return 4;
    return 5;
  };

  return [...items].sort((a, b) => {
    const d = score(a) - score(b);
    if (d !== 0) return d;
    return a.name.length - b.name.length || a.name.localeCompare(b.name, "fr");
  });
}
