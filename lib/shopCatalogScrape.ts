import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const PRICE_BUCKETS = [
  { label: "< 500 DT", min: 0, max: 500 },
  { label: "500 – 2 000 DT", min: 500, max: 2000 },
  { label: "2 000 – 5 000 DT", min: 2000, max: 5000 },
  { label: "5 000 – 15 000 DT", min: 5000, max: 15000 },
  { label: "> 15 000 DT", min: 15000, max: Infinity },
] as const;

export type PriceBucketRow = { label: string; count: number; pct: number };

const DEFAULT_SCRAPE_DIR = "C:/Users/stage.td/Desktop/current_scrapping/data";

export function resolveScrapeDir(): string | null {
  const fromEnv = process.env.SHOP_SCRAPE_DIR || process.env.STOCK_DIR;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  if (existsSync(DEFAULT_SCRAPE_DIR)) return DEFAULT_SCRAPE_DIR;
  return null;
}

function parsePrice(p: Record<string, unknown>): number | null {
  const raw = p?.price ?? p?.current_price ?? p?.sale_price;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 && n < 50000 ? Math.round(n * 100) / 100 : null;
}

export function isProductInStock(p: Record<string, unknown>): boolean {
  if (typeof p.available === "boolean") return p.available;
  const s = String(p.availability || p.stock_status || "").trim();
  if (!s) return true;
  const u = s.toUpperCase();
  if (/IN_?STOCK|EN STOCK|DISPONIBLE|AVAILABLE/.test(u)) return true;
  if (/OUT|RUPTURE|INDISPONIBLE|EPUISE|UNAVAILABLE|NON DISPON/.test(u)) return false;
  return true;
}

function parseScrapeTimestamp(folderName: string): number {
  const m = /^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})$/.exec(folderName);
  if (!m) return 0;
  const [, date, time] = m;
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi, s] = time.split("-").map(Number);
  return new Date(y, mo - 1, d, h, mi, s).getTime();
}

function findLatestDetailed(shopDir: string) {
  const candidates: { file: string; ts: number; count: number }[] = [];

  const addCandidate = (file: string, folder: string) => {
    const ts = parseScrapeTimestamp(folder) || statSync(file).mtimeMs;
    let count = 0;
    try {
      const a = JSON.parse(readFileSync(file, "utf-8"));
      count = Array.isArray(a) ? a.length : 0;
    } catch {}
    candidates.push({ file, ts, count });
  };

  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        const detailed = join(p, "products_detailed.json");
        if (existsSync(detailed)) addCandidate(detailed, e.name);
        walk(p);
      } else if (e.name === "products_detailed.json") {
        addCandidate(p, dir !== shopDir ? dir.split(/[/\\]/).pop() || "" : "root");
      }
    }
  };

  walk(shopDir);
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.ts - a.ts || b.count - a.count);
  return candidates[0];
}

export function loadShopPriceBuckets(shopKey: string, dataDir?: string | null): PriceBucketRow[] | null {
  const root = dataDir ?? resolveScrapeDir();
  if (!root) return null;

  const latest = findLatestDetailed(join(root, shopKey));
  if (!latest) return null;

  let arr: unknown[];
  try {
    arr = JSON.parse(readFileSync(latest.file, "utf-8"));
  } catch {
    return null;
  }
  if (!Array.isArray(arr)) return null;

  const counts = PRICE_BUCKETS.map(() => 0);
  let total = 0;

  for (const item of arr) {
    const p = item as Record<string, unknown>;
    if (!isProductInStock(p)) continue;
    const price = parsePrice(p);
    if (price == null) continue;
    total++;
    const idx = PRICE_BUCKETS.findIndex((b) => price >= b.min && price < b.max);
    if (idx >= 0) counts[idx]++;
  }

  if (total === 0) return null;

  return PRICE_BUCKETS.map((b, i) => ({
    label: b.label,
    count: counts[i],
    pct: Math.round((counts[i] / total) * 1000) / 10,
  }));
}
