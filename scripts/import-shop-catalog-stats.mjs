#!/usr/bin/env node
/** @deprecated Use scripts/refresh-homepage-stats.mjs or scripts/import-homepage-stats-db.mjs */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const res = spawnSync(process.execPath, [join(__dirname, "import-homepage-stats-db.mjs"), ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});
process.exit(res.status ?? 1);
