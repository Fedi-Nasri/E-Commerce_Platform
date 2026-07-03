import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { extractSpecs, matchesQuery, sameGroupKey, priceGapAllowed } from "@/lib/productSpecs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({ connectionString: process.env.SEMANTIC_DB_URL, max: 4 });

const OR_KEY = process.env.OPENROUTER_API_KEY!;
const EMBED_MODEL = process.env.LLM_EMBED_MODEL || "nvidia/llama-nemotron-embed-vl-1b-v2:free";
const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// Mots vides : trop génériques pour piloter la recherche mot-clé (AND).
const STOPWORDS = new Set([
  "pour", "avec", "sans", "des", "les", "une", "the", "and", "prix",
  "produit", "produits", "boutique", "meilleur", "pas", "cher", "tunisie",
]);

const KNN_LIMIT = 200;        // vecteur : large pour couvrir tout le catalogue pertinent
const KEYWORD_LIMIT = 150;    // fallback mot-clé (trigram) pour rattraper ce que le vecteur rate
const EF_SEARCH = 200;        // recall HNSW (défaut 40) → bien plus de vrais voisins
const MIN_SIMILARITY = 0.45;  // seuil bas : mode catalogue (toutes marques)
const MAX_RESULTS = 30;       // nombre de groupes affichés

type Row = {
  product_id: number;
  shop_key: string;
  shop_name: string;
  name: string;
  current_price: string | number;
  stock_status?: string;
  shop_product_url: string | null;
  image_url: string | null;
  similarity: number;
};

// Mots qui signalent un ACCESSOIRE / pièce détachée, pas le produit principal.
// Ex : "Nappe LCD pour Pc Portable Lenovo" ne doit pas passer avant un vrai PC.
const ACCESSORY_WORDS = [
  "nappe", "charnière", "charniere", "chargeur", "adaptateur", "batterie",
  "clavier", "coque", "housse", "étui", "etui", "protection", "verre trempé",
  "verre trempe", "câble", "cable", "support", "sacoche", "pochette", "film",
  "dalle", "écran de remplacement", "vitre", "ventilateur", "connecteur",
  "carte mère", "carte mere", "alimentation pour", "cordon", "fiche",
  "stylet", "télécommande", "telecommande", "filtre", "brosse", "sac",
  // accessoires additionnels (climatisation, réseau, etc.)
  "module wifi", "module wi-fi", "module", "wifi module", "kit de pose",
  "kit installation", "kit de fixation", "tuyau", "gaine", "bâche", "bache",
  "housse de protection", "recharge", "gaz r", "fluide", "compresseur",
  "carte électronique", "carte electronique", "capteur", "sonde", "hélice",
  "helice", "roulement", "courroie", "joint", "manette", "pièce", "piece",
  "spare", "accessoire",
];

/** Score de pertinence : + si le nom commence par les mots de la requête,
 *  -- fort si c'est un accessoire/pièce détachée. */
function relevanceScore(query: string, name: string): number {
  const q = query.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const n = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let score = 0;

  // Pénalité accessoire (le vrai produit doit passer devant)
  for (const w of ACCESSORY_WORDS) {
    if (n.includes(w)) { score -= 100; break; }
  }
  // "pour" en début de nom => très souvent une pièce/accessoire "pour X"
  if (/\bpour\b/.test(n.slice(0, 40))) score -= 40;

  // Bonus : les mots de la requête apparaissent tôt dans le titre
  const words = q.split(/\s+/).filter((w) => w.length >= 3);
  let matched = 0;
  for (const w of words) {
    const idx = n.indexOf(w);
    if (idx === -1) { score -= 8; continue; }
    matched++;
    score += 10;
    if (idx < 25) score += 10;   // apparaît tôt dans le titre
    if (idx < 12) score += 8;    // vraiment au début
  }

  // BONUS FORT : le titre COMMENCE par les mots de la requête (dans l'ordre).
  // Ex requête "climatiseur gree" → "Climatiseur Gree Tropicalisé…" passe devant.
  let prefixLen = 0;
  for (const w of words) {
    // on cherche le mot à la position courante (en ignorant petits séparateurs)
    const rest = n.slice(prefixLen).replace(/^[\s\-\/|,.]+/, "");
    if (rest.startsWith(w)) {
      prefixLen = n.length - rest.length + w.length;
      score += 30; // chaque mot de la requête trouvé consécutivement au début
    } else {
      break;
    }
  }
  if (words.length && n.startsWith(words[0])) score += 15;
  // Tous les mots de la requête présents => bonus de complétude
  if (words.length && matched === words.length) score += 12;

  return score;
}

/** Qualité estimée d'une image produit : plus haut = meilleur.
 *  Spacenet / Tunisianet ont des images fiables ; Mytek renvoie parfois un
 *  placeholder Magento (même chemin /media/catalog/product/), donc priorité + basse. */
function imageQuality(url: string | null, shopKey: string): number {
  if (!url) return 0;
  const u = url.toLowerCase();
  // Chemins cassés connus (anciens paths scrapés Mytek /x/y/)
  if (/mytek\.tn\/[a-z0-9]\/[a-z0-9]\//.test(u)) return 0;
  if (u.includes("placeholder") || u.includes("no_selection") || u.includes("/default/")) return 1;
  if (shopKey === "spacenet" || u.includes("spacenet.tn")) return 5;
  if (shopKey === "tunisianet" || u.includes("tunisianet.com")) return 5;
  if (u.includes("/media/catalog/product/")) return 3; // Mytek réel (mais peut être placeholder)
  return 2;
}

/** Retourne la meilleure des deux images pour l'affichage du groupe. */
function pickBetterImage(current: string | null, candidate: string | null, candidateShop: string): string | null {
  const qCand = imageQuality(candidate, candidateShop);
  const qCur = imageQuality(current, "");
  return qCand > qCur ? candidate : current;
}

async function embed(text: string): Promise<number[]> {
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${OR_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 500) }),
  });
  if (!res.ok) throw new Error(`embed failed: ${res.status}`);
  const j = await res.json();
  return j.data[0].embedding as number[];
}

async function llmExplain(query: string, groups: Group[]): Promise<string> {
  if (!GROQ_KEY || groups.length === 0) return "";
  try {
    const list = groups
      .slice(0, 6)
      .map((g) => {
        const cheapest = g.offers[0];
        return `- ${g.title} : dès ${Number(cheapest.price).toLocaleString("fr-FR")} DT (${cheapest.shop_name})`;
      })
      .join("\n");
    const prompt = `Tu es l'assistant 1111 LLM d'un comparateur de prix tunisien. L'utilisateur cherche : "${query}".
Voici les meilleurs produits trouvés, triés du moins cher au plus cher :
${list}

En 1 à 2 phrases courtes en français, résume le meilleur choix qualité-prix. Sois direct. Pas de listes, pas de markdown.`;
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: "user", content: prompt }], max_tokens: 150, temperature: 0.3 }),
    });
    if (!res.ok) return "";
    const j = await res.json();
    return (j.choices?.[0]?.message?.content || "").trim();
  } catch {
    return "";
  }
}

type Offer = {
  shop_key: string;
  shop_name: string;
  name: string;
  price: number;
  stock_status: string;
  url: string | null;
  image: string | null;
  similarity: number;
};
type Group = {
  title: string;        // nom du produit représentatif
  image: string | null; // image du produit représentatif
  offers: Offer[];      // toutes les offres (boutiques) pour ce produit, triées par prix
  min_price: number;
  relevance: number;    // pertinence (accessoires pénalisés)
  brandMatch: boolean;  // true si la marque du produit == marque demandée
};

export async function POST(req: NextRequest) {
  let query = "";
  try {
    const body = await req.json();
    query = (body.query || "").toString().trim();
  } catch {
    return NextResponse.json({ query: "", results: [], error: "Requête invalide" }, { status: 400 });
  }
  if (!query) {
    return NextResponse.json({ query, results: [], error: "Saisissez un produit à rechercher." }, { status: 400 });
  }
  if (!OR_KEY || !process.env.SEMANTIC_DB_URL) {
    return NextResponse.json({ query, results: [], error: "Service non configuré." }, { status: 500 });
  }

  const client = await pool.connect();
  try {
    // 1) Embedding de la requête
    const qvec = await embed(query);
    const vecLiteral = "[" + qvec.map((x) => x.toFixed(6)).join(",") + "]";

    // 2) Specs demandées par l'utilisateur (ex: btu=12000, ram=16...)
    const querySpecs = extractSpecs(query);
    // Marque demandée (si l'user a tapé "condor", "samsung"…) → boost marque exacte
    const wantedBrand = typeof querySpecs.marque === "string" ? querySpecs.marque : null;

    // Meilleur recall HNSW (défaut 40 → EF_SEARCH). SET simple (hors transaction) :
    // s'applique à la connexion, remise à zéro au retour dans le pool est inutile
    // car on la refixe à chaque requête.
    await client.query(`SET hnsw.ef_search = ${EF_SEARCH}`);
    // Seuil de similarité de mot pour l'opérateur trigram <% (tolérance typos).
    await client.query(`SET pg_trgm.word_similarity_threshold = 0.6`);

    // 3a) RECHERCHE VECTORIELLE (sémantique) — tout le catalogue pertinent
    const knn = await client.query<Row>(
      `SELECT product_id, shop_key, shop_name, name, current_price, stock_status,
              shop_product_url, image_url,
              1 - (embedding_h <=> $1::halfvec) AS similarity
       FROM sem_products
       WHERE embedding_h IS NOT NULL
       ORDER BY embedding_h <=> $1::halfvec
       LIMIT $2`,
      [vecLiteral, KNN_LIMIT]
    );

    // 3b) RECHERCHE MOT-CLÉ (exact + FUZZY trigram) — rattrape les produits que
    //     le vecteur rate, y compris avec une FAUTE DE FRAPPE ("vaiselle" →
    //     "vaisselle"). Chaque mot doit correspondre : soit littéralement (ILIKE),
    //     soit par similarité trigram (mot proche présent dans le nom).
    //     Mots courts autorisés (>=2) pour "pc", "tv"…
    const kwWords = query
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .split(/\s+/).filter((w) => w.length >= 2 && !STOPWORDS.has(w));
    let keywordRows: Row[] = [];
    if (kwWords.length) {
      // Pour chaque mot : ILIKE '%mot%'  OU  un mot du nom ressemble au mot (trigram).
      // word_similarity(mot, name) > 0.6 = très proche (tolère 1-2 lettres d'écart).
      const parts: string[] = [];
      const params: (string | number)[] = [];
      for (const w of kwWords) {
        params.push(`%${w}%`);          // ILIKE
        const likeIdx = params.length;
        params.push(w);                  // opérateur trigram indexable <%
        const simIdx = params.length;
        // mot présent littéralement OU un token très proche existe dans le nom.
        // `$w <% name` = word_similarity indexable (GIN) → rapide + tolère les typos.
        parts.push(`(name ILIKE $${likeIdx} OR $${simIdx} <% name)`);
      }
      const conds = parts.join(" AND ");
      params.push(vecLiteral);           // pour le tri par similarité vectorielle
      const vecIdx = params.length;
      params.push(KEYWORD_LIMIT);
      const limIdx = params.length;
      const kw = await client.query<Row>(
        `SELECT product_id, shop_key, shop_name, name, current_price, stock_status,
                shop_product_url, image_url,
                1 - (embedding_h <=> $${vecIdx}::halfvec) AS similarity
         FROM sem_products
         WHERE embedding_h IS NOT NULL AND ${conds}
         ORDER BY similarity DESC
         LIMIT $${limIdx}`,
        params
      );
      keywordRows = kw.rows;
    }

    // 3c) FUSION des deux ensembles (déduplication par product_id).
    //     Le mot-clé n'est PAS soumis au seuil de similarité (match textuel garanti).
    const seen = new Set<number>();
    const merged: (Row & { kw?: boolean })[] = [];
    for (const r of knn.rows) {
      if (r.similarity < MIN_SIMILARITY) continue;
      if (seen.has(r.product_id)) continue;
      seen.add(r.product_id); merged.push(r);
    }
    for (const r of keywordRows) {
      if (seen.has(r.product_id)) continue;
      seen.add(r.product_id); merged.push({ ...r, kw: true });
    }

    // 4) Filtre : conforme aux specs + TYPE + prix plausible pour la catégorie
    const candidates = merged.filter((r) =>
      matchesQuery(querySpecs, r.name, query, Number(r.current_price))
    );

    if (candidates.length === 0) {
      return NextResponse.json({ query, results: [] });
    }

    // 5) Regrouper les produits IDENTIQUES (même marque + specs) → 1 groupe
    //    avec toutes les boutiques qui le vendent, triées par prix.
    const groupsMap = new Map<string, Group>();
    for (const r of candidates) {
      const price = Number(r.current_price);
      const rel = relevanceScore(query, r.name);
      // La marque du produit correspond-elle à la marque demandée ?
      const prodBrand = extractSpecs(r.name).marque;
      const isBrandMatch = wantedBrand !== null && prodBrand === wantedBrand;
      const offer: Offer = {
        shop_key: r.shop_key,
        shop_name: r.shop_name,
        name: r.name,
        price,
        stock_status: r.stock_status || "inconnu",
        url: r.shop_product_url,
        image: r.image_url,
        similarity: Math.round(r.similarity * 1000) / 1000,
      };

      // Clé de regroupement. GARDE-FOU PRIX : si le produit a la même clé qu'un
      // groupe existant MAIS un écart de prix illogique (> seuil variable) avec
      // le moins cher du groupe, ce n'est PAS le même produit → on lui donne une
      // clé distincte. Évite d'associer un accessoire à 125 DT et un clim à 7299.
      const baseKey = sameGroupKey(r.name);
      let key = baseKey;
      let g = groupsMap.get(key);
      if (g) {
        const ref = Math.min(g.min_price, price);
        const gapAllowed = priceGapAllowed(ref);
        const gap = Math.abs(price - g.min_price) / g.min_price;
        if (gap > gapAllowed) {
          // écart de prix incohérent → produit distinct
          key = `${baseKey}#p${Math.round(price)}`;
          g = groupsMap.get(key);
        }
      }

      if (!g) {
        groupsMap.set(key, {
          title: r.name, image: pickBetterImage(null, r.image_url, r.shop_key), offers: [offer],
          min_price: price, relevance: rel, brandMatch: isBrandMatch,
        });
      } else {
        // 1 seule offre par boutique dans un groupe : garder la moins chère
        const existingIdx = g.offers.findIndex((o) => o.shop_key === offer.shop_key);
        if (existingIdx === -1) {
          g.offers.push(offer);
        } else if (price < g.offers[existingIdx].price) {
          g.offers[existingIdx] = offer;
        }
        if (price < g.min_price) {
          g.min_price = price;
          g.title = r.name;
        }
        // garde la meilleure pertinence du groupe
        if (rel > g.relevance) g.relevance = rel;
        if (isBrandMatch) g.brandMatch = true;
        // Choisit la MEILLEURE image du groupe (évite les placeholders Mytek)
        g.image = pickBetterImage(g.image, r.image_url, r.shop_key);
      }
    }

    // 6) Trier : offres par prix dans chaque groupe.
    //    Groupes : d'abord les PERTINENTS (accessoires en bas), puis par prix min.
    //    Seuil : on considère "pertinent" au-dessus de 0 ; en dessous = accessoire.
    const groups = [...groupsMap.values()]
      .map((g) => {
        g.offers.sort((a, b) => a.price - b.price);
        return g;
      })
      .sort((a, b) => {
        // 1) les vrais produits d'abord, les accessoires en bas
        const aAcc = a.relevance < 0 ? 1 : 0;
        const bAcc = b.relevance < 0 ? 1 : 0;
        if (aAcc !== bAcc) return aAcc - bAcc;
        // 2) BOOST MARQUE : si l'user a tapé une marque, ses produits d'abord
        //    (puis triés par prix), avant les autres marques (aussi par prix).
        if (wantedBrand) {
          const aBrand = a.brandMatch ? 0 : 1;
          const bBrand = b.brandMatch ? 0 : 1;
          if (aBrand !== bBrand) return aBrand - bBrand;
        }
        // 3) du moins cher au plus cher
        return a.min_price - b.min_price;
      })
      .slice(0, MAX_RESULTS)
      .map((g) => ({ ...g, is_accessory: g.relevance < 0 })); // flag pour le front

    // 7) Explication LLM (non bloquante)
    const explanation = await llmExplain(query, groups);

    return NextResponse.json({
      query,
      query_specs: querySpecs,
      count: groups.length,
      results: groups,
      explanation,
    });
  } catch (e: any) {
    return NextResponse.json(
      { query, results: [], error: "Erreur lors de la recherche. Réessayez." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
