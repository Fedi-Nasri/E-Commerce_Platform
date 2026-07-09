import type { MetadataRoute } from "next";
import { catalogPool } from "@/lib/db";
import { SITE_URL } from "@/lib/seo";

// Static sitemap index — lists every fixed route on the site.
// Product-level URLs (tens of thousands) ship in dedicated child sitemaps
// in the next step (app/sitemap-products/[id]/route.ts).
//
// Priorities are relative weights for crawlers, not absolute. Homepage and
// catalog hubs get the highest priority since they're updated most often
// and serve as primary entry points.


export const revalidate = 300;

type Entry = {
  path: string;
  changeFrequency?:
    | "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
};

const STATIC_ROUTES: Entry[] = [
  // Home / hubs
  { path: "/",                       changeFrequency: "daily",  priority: 1.0 },
  { path: "/supermarche",            changeFrequency: "daily",  priority: 0.95 },
  { path: "/parapharmacie",          changeFrequency: "daily",  priority: 0.95 },
  { path: "/retail",                 changeFrequency: "daily",  priority: 0.95 },
  { path: "/boutiques",              changeFrequency: "daily",  priority: 0.9 },
  { path: "/categories",             changeFrequency: "weekly", priority: 0.85 },
  { path: "/promotions",             changeFrequency: "daily",  priority: 0.9 },

  // Discovery / observability
  { path: "/comparaison",            changeFrequency: "weekly", priority: 0.7 },
  { path: "/barometres",             changeFrequency: "daily",  priority: 0.85 },
  { path: "/indice",                 changeFrequency: "daily",  priority: 0.85 },
  { path: "/observatoire",           changeFrequency: "daily",  priority: 0.85 },
  { path: "/sites-les-plus-visites", changeFrequency: "weekly", priority: 0.75 },
  { path: "/grande-distribution",    changeFrequency: "weekly", priority: 0.7 },
  { path: "/magasins",               changeFrequency: "weekly", priority: 0.7 },
  { path: "/ia-predictive",          changeFrequency: "weekly", priority: 0.7 },
  { path: "/couffin",                changeFrequency: "weekly", priority: 0.75 },
  { path: "/qoffa",                  changeFrequency: "weekly", priority: 0.6 },
  { path: "/qoffa/plats",            changeFrequency: "weekly", priority: 0.65 },
  { path: "/qoffa/plats/ojja-simple", changeFrequency: "weekly", priority: 0.6 },
  { path: "/qoffa/plats/makrouna-thon", changeFrequency: "weekly", priority: 0.6 },
  { path: "/veille",                 changeFrequency: "weekly", priority: 0.6 },

  // Legal / corporate
  { path: "/a-propos",                changeFrequency: "monthly", priority: 0.4 },
  { path: "/conditions-utilisation",  changeFrequency: "monthly", priority: 0.3 },
  { path: "/confidentialite",         changeFrequency: "monthly", priority: 0.3 },
];

// Boutique landing pages — one URL per shop slug — fetched live from the
// boutiques catalog so we always reflect the current shop roster.
async function fetchBoutiqueLandings(): Promise<Entry[]> {
  try {
    const r = await catalogPool().query<{ slug: string }>(
      `SELECT DISTINCT slug FROM shops WHERE slug IS NOT NULL ORDER BY slug`
    );
    return r.rows.map((row) => ({
      path: `/boutiques/${row.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.65,
    }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const boutiqueLandings = await fetchBoutiqueLandings();
  return [...STATIC_ROUTES, ...boutiqueLandings].map(
    ({ path, changeFrequency, priority }) => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
    })
  );
}
