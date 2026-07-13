#!/usr/bin/env node
/**
 * Full homepage stats refresh pipeline:
 *   1. (optional) Recompute top retail + para JSON from clusters
 *   2. Import all stats JSON + scrape prix moyen → PostgreSQL
 *
 * Env:
 *   RETAIL_DB_URL          — required for DB import
 *   STOCK_DIR / SHOP_SCRAPE_DIR — scrape root (default: VPS path or local)
 *   CLUSTERS_JSON          — product_clusters.json path (skip compute if unset)
 *
 * Usage:
 *   node scripts/refresh-homepage-stats.mjs
 *   node scripts/refresh-homepage-stats.mjs --skip-compute
 *   node scripts/refresh-homepage-stats.mjs --stock-dir=/home/ubuntu/scrapping/data
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const args = process.argv.slice(2);
const skipCompute = args.includes("--skip-compute");
const stockDirFlag = args.find((a) => a.startsWith("--stock-dir="));
const clustersFlag = args.find((a) => a.startsWith("--clusters="));

const DEFAULT_STOCK = existsSync("/home/ubuntu/scrapping/data")
  ? "/home/ubuntu/scrapping/data"
  : "C:/Users/stage.td/Desktop/current_scrapping/data";

const STOCK_DIR = stockDirFlag?.slice("--stock-dir=".length) ?? process.env.STOCK_DIR ?? process.env.SHOP_SCRAPE_DIR ?? DEFAULT_STOCK;

const DEFAULT_CLUSTERS = process.env.CLUSTERS_JSON ?? "C:/Users/stage.td/Downloads/ynqqn w/my_run_117/product_clusters.json";
const CLUSTERS = clustersFlag?.slice("--clusters=".length) ?? DEFAULT_CLUSTERS;

function run(label, cmd, cmdArgs, extraEnv = {}) {
  console.log(`\n▶ ${label}`);
  const res = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
    shell: process.platform === "win32",
  });
  if (res.status !== 0) {
    console.error(`✗ ${label} failed (exit ${res.status})`);
    process.exit(res.status ?? 1);
  }
}

console.log("═══ Homepage stats refresh ═══");
console.log(`  stock dir : ${STOCK_DIR}`);
console.log(`  clusters  : ${skipCompute ? "(skipped)" : CLUSTERS}`);

if (!skipCompute && existsSync(CLUSTERS)) {
  run(
    "Compute top retail shops",
    "node",
    [
      join(__dirname, "compute-top-retail-shops.mjs"),
      CLUSTERS,
      join(ROOT, "lib/data/topRetailShops.json"),
      `--stock-dir=${STOCK_DIR}`,
    ],
    { STOCK_DIR },
  );
  run(
    "Compute top para shops",
    "node",
    [
      join(__dirname, "compute-top-para-shops.mjs"),
      CLUSTERS,
      join(ROOT, "lib/data/topParaShops.json"),
      `--stock-dir=${STOCK_DIR}`,
    ],
    { STOCK_DIR },
  );
} else if (!skipCompute) {
  console.warn(`\n⚠ Clusters file not found (${CLUSTERS}) — keeping existing topRetail/topPara JSON`);
}

run(
  "Import all stats to PostgreSQL",
  "node",
  [join(__dirname, "import-homepage-stats-db.mjs"), `--stock-dir=${STOCK_DIR}`],
  { STOCK_DIR, SHOP_SCRAPE_DIR: STOCK_DIR },
);

console.log("\n✓ Homepage stats refresh complete");
console.log("  Tables: stats_prix_moyen_*, stats_top_retail_*, stats_para_*, stats_climatiseurs_*");
