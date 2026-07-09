import { Pool } from "pg";
import { catalogBySlug, catalogByScopeId } from "@/lib/priceRankings";

const pool = new Pool({ connectionString: process.env.RETAIL_DB_URL, max: 2 });

export type TierLeader = {
  key: string;
  label: string;
  classement: Array<{
    shop: string;
    ecart_pct: number;
    indice_ajuste: number;
    produits_compares: number;
    statut?: string;
    fiabilite?: string;
    win_rate_pct?: number;
  }>;
};

export type RankedShopRow = {
  rank: number;
  shop_key: string;
  products_compared: number;
  fair_win_rate: number;
  cheapest_score: number;
  median_price_index: number;
  avg_extra_cost_vs_cheapest: number;
  confidence: string;
  pairwise_comparisons?: number;
  wins?: number;
  losses?: number;
  ties?: number;
  ecart_pct?: number;
  win_rate_pct?: number;
  pvalue_binom?: number;
  statut?: string;
  fiabilite?: string;
  is_featured?: boolean;
  featured_rank?: number;
  robust_index?: number;
};

export type ScopeRanking = {
  scope_id: string;
  scope_name: string;
  level1_id: string | null;
  level2_id: string | null;
  matched_products: number;
  distinct_shops: number;
  generated_at: string | null;
  method?: string | null;
  paliers?: TierLeader[];
  shops: RankedShopRow[];
};

function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function mapShopRow(row: Record<string, unknown>): RankedShopRow {
  const fairWin = num(row.fair_win_rate) ?? 0;
  const avgIndex = num(row.avg_price_index);
  const cheapest = num(row.cheapest_score);
  const median = num(row.median_price_index);
  return {
    rank: num(row.rank) ?? 0,
    shop_key: String(row.shop_key ?? ""),
    products_compared: num(row.products_compared) ?? 0,
    fair_win_rate: fairWin,
    cheapest_score: cheapest ?? 0,
    median_price_index: median ?? 0,
    avg_extra_cost_vs_cheapest: num(row.avg_extra_cost_vs_cheapest) ?? 0,
    confidence: String(row.confidence ?? ""),
    pairwise_comparisons: num(row.pairwise_comparisons),
    wins: num(row.wins),
    losses: num(row.losses),
    ties: num(row.ties),
    ecart_pct: num(row.ecart_pct),
    win_rate_pct: num(row.win_rate_pct),
    pvalue_binom: num(row.pvalue_binom),
    statut: row.statut != null ? String(row.statut) : undefined,
    fiabilite: row.fiabilite != null ? String(row.fiabilite) : undefined,
    is_featured: Boolean(row.is_featured),
    featured_rank: num(row.featured_rank),
    robust_index: avgIndex ?? cheapest ?? median ?? 1,
  };
}

const SHOP_COLS = `rank, shop_key, products_compared, fair_win_rate, cheapest_score,
              median_price_index, avg_extra_cost_vs_cheapest, confidence,
              pairwise_comparisons, wins, losses, ties,
              ecart_pct, win_rate_pct, pvalue_binom, statut, fiabilite,
              is_featured, featured_rank, avg_price_index`;

async function queryScope(scopeId: string, shopLimit = 50): Promise<ScopeRanking | null> {
  const client = await pool.connect();
  try {
    const scopeRes = await client.query(
      `SELECT scope_id, scope_name, level1_id, level2_id, matched_products, distinct_shops,
              generated_at, method, meta_json
       FROM price_ranking_scopes WHERE scope_id = $1`,
      [scopeId]
    );
    if (!scopeRes.rows[0]) return null;

    const shopsRes = await client.query(
      `SELECT ${SHOP_COLS}
       FROM price_ranking_shops
       WHERE scope_id = $1
       ORDER BY rank ASC
       LIMIT $2`,
      [scopeId, shopLimit]
    );

    const meta = scopeRes.rows[0].meta_json;
    const paliers = typeof meta === "object" && meta?.paliers ? meta.paliers : [];

    return {
      ...scopeRes.rows[0],
      paliers,
      shops: shopsRes.rows.map(mapShopRow),
    };
  } finally {
    client.release();
  }
}

export async function getRankingBySlug(slug: string, shopLimit = 15) {
  const catalog = catalogBySlug(slug);
  if (!catalog) return null;
  const scope = await queryScope(catalog.scopeId, shopLimit);
  if (!scope) return null;
  return { catalog, scope };
}

export async function getFeaturedRankings(shopLimit = 3) {
  const client = await pool.connect();
  try {
    const scopesRes = await client.query(
      `SELECT scope_id, scope_name, level1_id, level2_id, matched_products, distinct_shops, method
       FROM price_ranking_scopes
       ORDER BY scope_id`
    );

    const shopsRes = await client.query(
      `SELECT scope_id, ${SHOP_COLS}
       FROM price_ranking_shops
       WHERE is_featured = TRUE AND featured_rank IS NOT NULL AND featured_rank <= $1
       ORDER BY scope_id, featured_rank ASC`,
      [shopLimit]
    );

    const byScope = new Map<string, RankedShopRow[]>();
    for (const row of shopsRes.rows) {
      if (!byScope.has(row.scope_id)) byScope.set(row.scope_id, []);
      byScope.get(row.scope_id)!.push(mapShopRow(row));
    }

    // Fallback for legacy data without featured flags
    if (shopsRes.rows.length === 0) {
      const legacy = await client.query(
        `SELECT scope_id, ${SHOP_COLS}
         FROM price_ranking_shops
         WHERE rank <= $1
         ORDER BY scope_id, rank`,
        [shopLimit]
      );
      for (const row of legacy.rows) {
        if (!byScope.has(row.scope_id)) byScope.set(row.scope_id, []);
        byScope.get(row.scope_id)!.push(mapShopRow(row));
      }
    }

    return scopesRes.rows.map((s) => ({
      scope_id: s.scope_id,
      scope_name: s.scope_name,
      matched_products: num(s.matched_products) ?? 0,
      distinct_shops: num(s.distinct_shops) ?? 0,
      shops: (byScope.get(s.scope_id) ?? []).map((shop) => ({
        ...shop,
        rank: num(shop.rank) ?? shop.rank,
        fair_win_rate: num(shop.fair_win_rate) ?? shop.fair_win_rate,
        products_compared: num(shop.products_compared) ?? shop.products_compared,
        ecart_pct: num(shop.ecart_pct) ?? shop.ecart_pct,
        featured_rank: num(shop.featured_rank) ?? shop.featured_rank,
      })),
    }));
  } finally {
    client.release();
  }
}

export function attachCatalog<T extends { scope_id: string }>(scopes: T[]) {
  return scopes
    .map((s) => ({ ...s, catalog: catalogByScopeId(s.scope_id) }))
    .filter((s) => s.catalog);
}

export function featuredShops(scope: ScopeRanking) {
  const featured = scope.shops
    .filter((s) => s.is_featured && s.featured_rank)
    .sort((a, b) => (a.featured_rank ?? 99) - (b.featured_rank ?? 99));
  if (featured.length >= 3) return featured.slice(0, 3);
  return scope.shops
    .filter((s) => s.fiabilite !== "Insuffisant")
    .slice(0, 3);
}

export function scopeLeader(scope: ScopeRanking) {
  const featured = featuredShops(scope);
  return featured[0] ?? scope.shops[0] ?? null;
}
