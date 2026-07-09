#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const input = process.argv[2];
const output = process.argv[3];

if (!input || !output) {
  console.error("Usage: node scripts/convert-robust-to-price-rankings.mjs <robust.json> <out.json>");
  process.exit(1);
}

const SCOPE_MAP = {
  electromenager: {
    scope_id: "home_appliances/*",
    scope_name: "Électroménager",
    level1_id: "home_appliances",
    level2_id: null,
  },
  tv_son: {
    scope_id: "tv_audio_photo/televisions",
    scope_name: "Télévisions",
    level1_id: "tv_audio_photo",
    level2_id: "televisions",
  },
  smartphone: {
    scope_id: "phones_tablets_wearables/smartphones",
    scope_name: "Smartphones",
    level1_id: "phones_tablets_wearables",
    level2_id: "smartphones",
  },
  climatiseur: {
    scope_id: "home_appliances/ac_climate",
    scope_name: "Climatisation",
    level1_id: "home_appliances",
    level2_id: "ac_climate",
  },
  pc: {
    scope_id: "computing_it/laptops",
    scope_name: "PC portables",
    level1_id: "computing_it",
    level2_id: "laptops",
  },
  informatique: {
    scope_id: "computing_it/*",
    scope_name: "Informatique",
    level1_id: "computing_it",
    level2_id: null,
  },
};

function confidenceFromFiabilite(fiabilite) {
  if (fiabilite === "Très fiable" || fiabilite === "Fiable") return "enough_data";
  if (fiabilite === "Faible échantillon") return "enough_data";
  return "low_data";
}

function mapShopRow(row, rank, featured = false, featuredRank = null) {
  const winRate = Number(row.win_rate_pct ?? 0) / 100;
  return {
    rank,
    shop: row.boutique,
    products_compared: row.produits_compares ?? null,
    coverage_rate: null,
    pairwise_comparisons: row.produits_compares ?? null,
    wins: null,
    losses: null,
    ties: null,
    fair_win_rate: winRate,
    cheapest_score: row.indice_ajuste ?? null,
    avg_price_index: row.indice_ajuste ?? null,
    median_price_index: row.indice_ajuste ?? null,
    avg_extra_cost_vs_cheapest: row.ecart_pct ?? null,
    ecart_pct: row.ecart_pct ?? null,
    win_rate_pct: row.win_rate_pct ?? null,
    pvalue_binom: row.pvalue_binom ?? null,
    statut: row.statut ?? null,
    fiabilite: row.fiabilite ?? null,
    confidence: confidenceFromFiabilite(row.fiabilite),
    is_featured: featured,
    featured_rank: featuredRank,
  };
}

function pickFeatured(globalRows) {
  const reliable = globalRows
    .filter((r) => r.fiabilite !== "Insuffisant" && (r.produits_compares ?? 0) >= 100)
    .sort((a, b) => (a.indice_ajuste ?? 9) - (b.indice_ajuste ?? 9));
  if (reliable.length >= 3) return reliable.slice(0, 3).map((r) => r.boutique);
  const fallback = globalRows
    .filter((r) => r.fiabilite !== "Insuffisant" && (r.produits_compares ?? 0) >= 20)
    .sort((a, b) => (a.indice_ajuste ?? 9) - (b.indice_ajuste ?? 9));
  return fallback.slice(0, 3).map((r) => r.boutique);
}

const raw = JSON.parse(readFileSync(input, "utf8"));
const scopes = [];

for (const [catKey, mapping] of Object.entries(SCOPE_MAP)) {
  const category = raw?.categories?.[catKey];
  if (!category) continue;

  const globalRows = [...(category.classement_global ?? [])].sort(
    (a, b) => (a.indice_ajuste ?? 9) - (b.indice_ajuste ?? 9),
  );
  const featuredKeys = pickFeatured(globalRows);
  const featuredOrder = featuredKeys.reduce((acc, key, i) => {
    acc[key] = i + 1;
    return acc;
  }, {});

  const ranked_shops = globalRows.map((row, idx) =>
    mapShopRow(row, idx + 1, featuredKeys.includes(row.boutique), featuredOrder[row.boutique] ?? null),
  );

  const paliers = Object.entries(category.paliers ?? {}).map(([key, pal]) => ({
    key,
    label: pal.label,
    min_produits: pal.min_produits,
    max_produits: pal.max_produits,
    classement: (pal.classement ?? []).map((row, idx) => ({
      rank: idx + 1,
      shop: row.boutique,
      indice_ajuste: row.indice_ajuste,
      ecart_pct: row.ecart_pct,
      win_rate_pct: row.win_rate_pct,
      produits_compares: row.produits_compares,
      statut: row.statut,
      fiabilite: row.fiabilite,
    })),
  }));

  scopes.push({
    ...mapping,
    matched_products_in_scope: category.produits_comparables ?? 0,
    distinct_shops: ranked_shops.length,
    method: "robust_shrinkage_in_stock",
    paliers,
    ranked_shops,
  });
}

const out = {
  metadata: {
    generated_at: raw.generated_at,
    source: "robust_shrinkage_in_stock",
    method: "log-indice + shrinkage bayésien (k=15) + test binomial",
    note: "Detail pages use full ranking; homepage cards use featured large-catalog shops.",
  },
  scopes,
};

writeFileSync(output, JSON.stringify(out, null, 2), "utf8");
console.log(`Written ${output} with ${scopes.length} scopes.`);
