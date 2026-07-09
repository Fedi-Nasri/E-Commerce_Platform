#!/usr/bin/env node
/**
 * Reversible retail catalogue refresh (runs ON the VPS, retail_db :5433).
 *
 * Input: merged JSONL of products_detailed.json from healthy retail shops.
 * Each line: { url, shop, top_category, low_category, subcategory, title,
 *              product_id, sku, brand, price, old_price, available,
 *              availability, images[], specifications{} }
 *
 * Strategy — upsert by (shop_id, shop_product_url), never delete:
 *   - Existing catalogue product for that URL → refresh price/images/specs/cat.
 *   - New URL → insert a fresh unmatched (is_matched=FALSE) product.
 *   - Healthy-shop catalogue products whose URL is NOT in this scrape → set
 *     status='archived' (hidden, reversible), tagged with the batch id.
 *
 * Untouched: cluster_* matched products, and any shop not present in the file
 * (e.g. failed-scrape shops keep their existing catalogue).
 *
 * Reversibility: a temp column products.refresh_batch stamps every row this run
 * creates/updates/archives. Rollback options printed at the end.
 *
 * Usage:
 *   node refresh-retail-catalog.mjs <merged.jsonl> <batch_id> [--dry-run]
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import pg from "pg";
import crypto from "node:crypto";

const { Pool } = pg;
const FILE = process.argv.find((a) => a.endsWith(".jsonl"));
const BATCH = process.argv.find((a) => /^batch_/.test(a)) || `batch_${Date.now()}`;
const DRY = process.argv.includes("--dry-run");
if (!FILE) { console.error("Usage: node refresh-retail-catalog.mjs <merged.jsonl> <batch_id> [--dry-run]"); process.exit(1); }

const pool = new Pool({
  host: "localhost", port: Number(process.env.RETAIL_PORT || 5433),
  user: "retail_user", password: "galylio-ai", database: "retail_db", max: 4,
});

const slugify = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180) || "produit";
// Retail prices in Tunisia realistically fall under ~50,000 DT. Some scrapers
// occasionally emit corrupted values (e.g. concatenated digits from a bad price
// parse) — reject those instead of importing garbage.
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0.5 && n <= 50000 ? n : null; };
const isHttp = (u) => typeof u === "string" && /^https?:\/\//.test(u);

// Category normalizer: shop top_category label → canonical retail slug.
// (Same rule spirit as transform-clusters-to-retail; unknown → non-categorise.)
function normCat(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/chevron_right|promo\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}
const CAT_RULES = [
  [/pc portable gamer|portable gamer/, "pc-portables-gamer"], [/pc (de )?bureau gamer/, "pc-de-bureau-gamer"],
  [/pc gamer/, "pc-de-bureau-gamer"], [/pc portable|laptop|ordinateur portable/, "pc-portables"],
  [/pc (de )?bureau|ordinateur (de )?bureau|desktop/, "pc-de-bureau"], [/apple|macbook|imac/, "ordinateurs-apple"],
  [/smartphone|mobile|gsm/, "smartphones"], [/tablette|ipad/, "tablettes"],
  [/smart ?watch|montre connectee|objet connecte/, "montres-et-objets-connectes"], [/montre|bijou/, "montres-et-bijoux"],
  [/accessoire.*telephon|telephonie.*accessoire/, "accessoires-telephonie"], [/telephonie|telephone/, "smartphones"],
  [/carte graphique|processeur|carte mere|ram|memoire|composant/, "composants"],
  [/stockage|ssd|disque dur|cle usb/, "stockage"], [/accessoire.*(pc|ordinateur|informatique)|peripherique/, "accessoires-informatiques"],
  [/reseau|securite|surveillance|routeur|switch|serveur/, "reseaux-serveurs-et-securite"],
  [/ecran|moniteur/, "ecrans-et-moniteurs"], [/imprimante|scanner|impression/, "imprimantes-et-scanners"],
  [/encre|toner|cartouche|consommable/, "encre-et-toner"], [/onduleur|alimentation|batterie|chargeur/, "onduleurs-et-alimentation"],
  [/logiciel|software/, "logiciels"], [/gaming|manette/, "accessoires-gamer"], [/console|playstation|xbox|nintendo/, "consoles"],
  [/jeu video|jeux video/, "jeux-video"], [/casque|ecouteur/, "casques-et-ecouteurs"],
  [/enceinte|haut.?parleur|barre de son/, "enceintes-et-haut-parleurs"], [/micro\b|microphone/, "microphones"],
  [/home cinema|streaming/, "home-cinema-et-streaming"], [/televiseur|television|\btv\b/, "televisions"],
  [/appareil photo|camera|photo/, "appareils-photo"], [/videoprojecteur|projecteur|projection/, "videoprojecteurs"],
  [/image (et |& )?son|audio|hifi|son/, "audio-general"], [/climatiseur|climatisation|clim\b/, "climatiseurs"],
  [/chauffage|chauffe.?eau|radiateur/, "chauffage"], [/ventilat|purificateur/, "ventilation-et-traitement-d-air"],
  [/refriger|frigo|congelateur|froid/, "froid-et-refrigeration"], [/lave.?linge|machine a laver|lavage|seche.?linge/, "lavage"],
  [/aspirateur|nettoyage/, "aspirateurs-et-nettoyage"], [/cuisson|four|micro.?onde|plaque|cuisiniere/, "cuisson"],
  [/petit electro|preparation culinaire|blender|mixeur|robot|cafe|bouilloire|grille pain|friteuse/, "petit-electromenager"],
  [/gros electro|electromenager|electro menager/, "gros-electromenager"], [/ustensile|vaisselle|art de la table|cuisine/, "cuisine-et-vaisselle"],
  [/meuble.*bureau|mobilier.*bureau/, "meubles-de-bureau"], [/chaise|fauteuil|salon|meuble|mobilier/, "meubles"],
  [/linge de maison|linge/, "accessoires-maison-et-decoration"], [/decoration|luminaire|eclairage|lampe/, "eclairage-et-electricite"],
  [/bricolage|outil|quincaillerie/, "outils-et-quincaillerie"], [/jardin|exterieur/, "jardin-et-exterieur"],
  [/piscine/, "piscines"], [/salle de bain|plomberie/, "salle-de-bain-et-plomberie"],
  [/bureautique|fourniture.*bureau|papeterie|papier\b/, "fournitures-de-bureau"], [/scolaire/, "fournitures-scolaires"],
  [/livre|book/, "livres"], [/moto|scooter/, "moto-et-scooter"], [/velo|trottinette/, "velos-et-mobilite-urbaine"],
  [/pneu\b/, "pneus"], [/auto\b|voiture/, "accessoires-auto"], [/fitness|musculation/, "fitness-et-musculation"],
  [/sport|loisir/, "equipement-sport"], [/jouet/, "jouets-et-jeux"], [/medical|orthopedie/, "medical-et-orthopedie"],
  [/meilleures? ventes/, "meilleures-ventes"], [/promo|offre/, "promotions-et-offres"],
  [/cable|connectique|adaptateur|clavier|souris/, "accessoires-informatiques"], [/informatique/, "accessoires-informatiques"],
];
function mapCat(raw) {
  const n = normCat(raw);
  if (!n) return "non-categorise";
  for (const [re, slug] of CAT_RULES) if (re.test(n)) return slug;
  return "non-categorise";
}

async function main() {
  const client = await pool.connect();
  try {
    if (!DRY) {
      await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS refresh_batch TEXT`);
    }

    const shopByKey = new Map();
    for (const r of (await client.query("SELECT id, shop_key FROM shops")).rows) shopByKey.set(r.shop_key, r.id);
    const topBySlug = new Map();
    for (const r of (await client.query("SELECT id, slug FROM top_categories")).rows) topBySlug.set(r.slug, r.id);
    if (!topBySlug.has("non-categorise")) {
      const r = await client.query(`INSERT INTO top_categories (name,slug,status) VALUES ('Non catégorisé','non-categorise','active') ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`);
      topBySlug.set("non-categorise", r.rows[0].id);
    }
    const brandBySlug = new Map();
    for (const r of (await client.query("SELECT id, slug FROM brands")).rows) brandBySlug.set(r.slug, r.id);
    const slugsSeen = new Set();
    for (const r of (await client.query("SELECT slug FROM products")).rows) slugsSeen.add(r.slug);

    // Existing catalogue products keyed by URL (unmatched only — never touch clusters)
    const byUrl = new Map(); // shop_product_url -> product_id
    const cur = await client.query(`
      SELECT sp.shop_product_url, sp.product_id
      FROM shop_prices sp JOIN products p ON p.id=sp.product_id
      WHERE p.is_matched=FALSE AND sp.shop_product_url<>''`);
    for (const r of cur.rows) byUrl.set(r.shop_product_url, r.product_id);
    console.log(`Existing unmatched catalogue URLs: ${byUrl.size}`);

    const subByTop = new Map();
    async function subForTop(topSlug) {
      if (subByTop.has(topSlug)) return subByTop.get(topSlug);
      const topId = topBySlug.get(topSlug) ?? topBySlug.get("non-categorise");
      const low = await client.query(`INSERT INTO low_categories (top_category_id,name,slug,status) VALUES ($1,$2,$3,'active') ON CONFLICT (top_category_id,slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [topId, topSlug, topSlug]);
      const sub = await client.query(`INSERT INTO subcategories (low_category_id,name,slug,status) VALUES ($1,$2,$3,'active') ON CONFLICT (low_category_id,slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [low.rows[0].id, topSlug, topSlug]);
      subByTop.set(topSlug, sub.rows[0].id);
      return sub.rows[0].id;
    }

    let created = 0, updated = 0, skipped = 0, imgSet = 0, batch = 0;
    const seenUrlsByShop = new Map(); // shop_key -> Set(url), for archive step
    const healthyShops = new Set();

    const rl = createInterface({ input: createReadStream(FILE, { encoding: "utf8" }), crlfDelay: Infinity });
    for await (const line of rl) {
      const t = line.trim(); if (!t) continue;
      let p; try { p = JSON.parse(t); } catch { skipped++; continue; }
      const shopId = shopByKey.get(p.shop);
      const url = p.url;
      // Recover title/price for pages that failed deep-load: the scraper keeps a
      // _listing_fp = [price, old_price, title, url, ...] fallback from the
      // listing page. Without this we'd drop ~51k real products and then wrongly
      // archive them as "vanished".
      if (!p.title && Array.isArray(p._listing_fp)) {
        const fp = p._listing_fp;
        const t2 = fp.find((x) => typeof x === "string" && x.length > 3 && !/^https?:/.test(x));
        if (t2) p.title = t2;
        if (p.price == null && typeof fp[0] === "number") p.price = fp[0];
        if (p.old_price == null && typeof fp[1] === "number") p.old_price = fp[1];
      }
      if (!shopId || !isHttp(url) || !p.title) { skipped++; continue; }
      healthyShops.add(p.shop);
      if (!seenUrlsByShop.has(p.shop)) seenUrlsByShop.set(p.shop, new Set());
      seenUrlsByShop.get(p.shop).add(url);

      if (DRY) { (byUrl.has(url) ? updated++ : created++); if (++batch % 20000 === 0) process.stdout.write(`\r  scanned ${batch}...`); continue; }

      await client.query("BEGIN");
      try {
        // brand
        let brandId = null;
        if (p.brand && p.brand !== "None") {
          const bslug = slugify(p.brand);
          brandId = brandBySlug.get(bslug);
          if (!brandId) { const br = await client.query(`INSERT INTO brands (name,slug,status) VALUES ($1,$2,'active') ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [p.brand, bslug]); brandId = br.rows[0].id; brandBySlug.set(bslug, brandId); }
        }

        let productId = byUrl.get(url);
        if (productId) {
          await client.query(`UPDATE products SET name=$2, brand_id=$3, status='active', refresh_batch=$4, updated_at=now() WHERE id=$1`, [productId, p.title, brandId, BATCH]);
          updated++;
        } else {
          let base = slugify(p.title), s = base, i = 2;
          while (slugsSeen.has(s)) s = `${base}-${i++}`;
          slugsSeen.add(s);
          const sourceId = `${p.shop}::${p.product_id || crypto.createHash("md5").update(url).digest("hex").slice(0,16)}`;
          const r = await client.query(`INSERT INTO products (source_product_id,name,slug,brand_id,source_url,is_matched,status,refresh_batch) VALUES ($1,$2,$3,$4,$5,FALSE,'active',$6) RETURNING id`, [sourceId, p.title, s, brandId, url, BATCH]);
          productId = r.rows[0].id; byUrl.set(url, productId); created++;
        }

        // category
        const subId = await subForTop(mapCat(p.top_category));
        await client.query(`INSERT INTO product_subcategories (product_id,subcategory_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [productId, subId]);

        // price
        await client.query(`INSERT INTO shop_prices (product_id,shop_id,current_price,regular_price,shop_product_url) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (product_id,shop_id) DO UPDATE SET current_price=EXCLUDED.current_price, regular_price=EXCLUDED.regular_price, shop_product_url=EXCLUDED.shop_product_url, updated_at=now()`, [productId, shopId, num(p.price), num(p.old_price), url]);

        // images (real product images only — skip obvious banner/logo assets)
        const imgs = (Array.isArray(p.images) ? p.images : []).filter(isHttp).filter((u) => !/livraison|logo|banner|assets\/img/i.test(u)).slice(0, 8);
        if (imgs.length) {
          imgSet++;
          for (const im of imgs) await client.query(`INSERT INTO product_images (product_id,image_url) VALUES ($1,$2) ON CONFLICT (product_id,image_url) DO NOTHING`, [productId, im]);
        }

        // specs
        if (p.specifications && typeof p.specifications === "object") {
          for (const [k, v] of Object.entries(p.specifications)) {
            if (!k || v == null || String(v).length > 500) continue;
            await client.query(`INSERT INTO product_specs (product_id,spec_key,spec_value) VALUES ($1,$2,$3) ON CONFLICT (product_id,spec_key,spec_value) DO NOTHING`, [productId, String(k).slice(0,120), String(v).slice(0,500)]);
          }
        }
        await client.query("COMMIT");
      } catch (e) { await client.query("ROLLBACK"); skipped++; if (skipped <= 5) console.error("row failed:", url, e.message); }

      if (++batch % 2000 === 0) process.stdout.write(`\r  processed ${batch}... (new ${created}, upd ${updated}, img ${imgSet})`);
    }
    process.stdout.write("\n");

    // Archive step: healthy-shop catalogue products whose URL vanished from the scrape.
    let archived = 0;
    if (!DRY) {
      for (const shop of healthyShops) {
        const shopId = shopByKey.get(shop);
        const seen = seenUrlsByShop.get(shop);
        // pull current URLs for this shop's unmatched products
        const rows = (await client.query(`
          SELECT p.id, sp.shop_product_url FROM products p
          JOIN shop_prices sp ON sp.product_id=p.id
          WHERE sp.shop_id=$1 AND p.is_matched=FALSE AND p.status='active'`, [shopId])).rows;
        const stale = rows.filter((r) => r.shop_product_url && !seen.has(r.shop_product_url)).map((r) => r.id);
        for (let i = 0; i < stale.length; i += 500) {
          const chunk = stale.slice(i, i + 500);
          await client.query(`UPDATE products SET status='archived', refresh_batch=$2, updated_at=now() WHERE id = ANY($1::bigint[]) AND is_matched=FALSE`, [chunk, `${BATCH}_archived`]);
          archived += chunk.length;
        }
      }
    }

    console.log(DRY
      ? `DRY RUN: ${created} new, ${updated} refreshed, ${skipped} skipped across ${healthyShops.size} shops`
      : `✓ new ${created}, refreshed ${updated}, archived ${archived}, img ${imgSet}, skipped ${skipped}`);
    if (!DRY) {
      console.log(`\nBatch tag: ${BATCH}`);
      console.log(`ROLLBACK options:`);
      console.log(`  # un-archive: UPDATE products SET status='active' WHERE refresh_batch='${BATCH}_archived';`);
      console.log(`  # delete new rows this run: DELETE FROM products WHERE refresh_batch='${BATCH}' AND source_product_id LIKE '%::%';`);
      console.log(`  # or full restore from the pg_dump taken before this run.`);
    }
  } finally { client.release(); await pool.end(); }
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
