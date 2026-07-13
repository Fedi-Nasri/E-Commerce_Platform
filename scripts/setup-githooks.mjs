#!/usr/bin/env node
/**
 * Install repo git hooks (strips Cursor co-author from commits).
 * Run once after clone: node scripts/setup-githooks.mjs
 */
import { copyFileSync, chmodSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const src = join(ROOT, ".githooks", "prepare-commit-msg");
const destDir = join(ROOT, ".git", "hooks");
const dest = join(destDir, "prepare-commit-msg");

if (!existsSync(src)) {
  console.error("Missing .githooks/prepare-commit-msg");
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
try {
  chmodSync(dest, 0o755);
} catch {
  // Windows may ignore chmod
}

console.log("✓ Installed prepare-commit-msg hook (strips Cursor co-author)");
