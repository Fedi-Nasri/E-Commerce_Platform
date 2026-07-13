#!/usr/bin/env node
/**
 * Remove Cursor co-author trailers from a git commit message file.
 * Used by .githooks/prepare-commit-msg
 */
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
if (!file) process.exit(0);

const COAUTHOR_RE = /^Co-authored-by:\s*Cursor\s*<cursoragent@cursor\.com>\s*$/im;

const text = readFileSync(file, "utf8");
const cleaned = text
  .split(/\r?\n/)
  .filter((line) => !COAUTHOR_RE.test(line))
  .join("\n")
  .replace(/\n{3,}/g, "\n\n")
  .replace(/\n+$/, "\n");

if (cleaned !== text) {
  writeFileSync(file, cleaned, "utf8");
}
