#!/usr/bin/env node
/**
 * Merge each healthy retail shop's products_detailed.json (latest scrape) into
 * one JSONL for the retail catalogue refresh.
 *
 * - Only the 55 retail shops are considered.
 * - A shop is "healthy" if its scrape has >= MIN_PRODUCTS (default 50). Failed
 *   scrapes are skipped so we never wipe a shop's catalogue with an empty run.
 *
 * Usage:
 *   node scripts/merge-scraped-retail.mjs <data_dir> <out.jsonl> [--min=50]
 */
import { readdirSync, statSync, createWriteStream, readFileSync } from "node:fs";
import { join } from "node:path";

const [dataDir, outPath, ...flags] = process.argv.slice(2);
if (!dataDir || !outPath) { console.error("Usage: node merge-scraped-retail.mjs <data_dir> <out.jsonl> [--min=50]"); process.exit(1); }
const MIN = Number((flags.find((f) => f.startsWith("--min=")) || "--min=50").split("=")[1]);

const RETAIL_SHOPS = ("spacenet mytek tunisianet gamershop technopro tunewtec carthagoinformatique affariyet " +
  "wiki jumbo bestbuytunisie bill electrohadjkacem zoom alarabia kamounhome sangour yatoo mbm darty infotec jmb " +
  "maalejaudio techgate krichen tokyo_store dokani try_and_buy batam agora bstech qsnet koktahome sbs allani emh " +
  "chaktech informatica itechstore acspace taktek electrochaabani expert_gaming psstore scoop graiet techland " +
  "electrobennjima skymill imag megapc topbureau sigshop ispace benzarti-electromenager").split(/\s+/);

// Find the best products_detailed.json under a shop folder.
// Scrape timestamp lives in the folder name (YYYY-MM-DD_HH-MM-SS), which is more
// reliable than file mtime (mtime = when copied to disk). Rank by that date
// desc; among the newest date, prefer the file with the most products (avoids
// picking an empty/failed run that happens to share the latest timestamp).
function findDetailed(shopDir) {
  const candidates = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "products_detailed.json") {
        const m = /(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/.exec(dir);
        let count = 0;
        try { const a = JSON.parse(readFileSync(p, "utf-8")); count = Array.isArray(a) ? a.length : 0; } catch {}
        candidates.push({ p, date: m ? m[1] : "", count });
      }
    }
  };
  walk(shopDir);
  if (!candidates.length) return null;
  candidates.sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : b.count - a.count));
  return candidates[0].p;
}

const out = createWriteStream(outPath, { encoding: "utf-8" });
const healthy = [], failed = [];
let totalWritten = 0;

for (const shop of RETAIL_SHOPS) {
  const shopDir = join(dataDir, shop);
  const file = findDetailed(shopDir);
  if (!file) { failed.push([shop, "no-file"]); continue; }
  let arr;
  try { arr = JSON.parse(readFileSync(file, "utf-8")); } catch { failed.push([shop, "parse-error"]); continue; }
  if (!Array.isArray(arr)) { failed.push([shop, "not-array"]); continue; }
  if (arr.length < MIN) { failed.push([shop, `too-few:${arr.length}`]); continue; }

  let n = 0;
  for (const p of arr) {
    // normalize shop key (some scrapes leave shop null)
    p.shop = shop;
    out.write(JSON.stringify(p) + "\n");
    n++;
  }
  healthy.push([shop, n]);
  totalWritten += n;
}

out.end();

console.log(`✓ Merged ${healthy.length} healthy shops → ${totalWritten} products → ${outPath}`);
console.log(`\nHealthy shops:`);
for (const [s, n] of healthy.sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(6)}  ${s}`);
console.log(`\nSkipped (failed / below min ${MIN}): ${failed.length}`);
for (const [s, why] of failed) console.log(`  ${s.padEnd(24)} ${why}`);
