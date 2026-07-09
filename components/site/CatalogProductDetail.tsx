"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ChevronRight, ExternalLink, FileText,
  Scale, ShieldCheck, Sparkles, Store, Tag, TrendingUp, Truck,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FavoriteAlertButtons } from "@/components/site/FavoriteAlertButtons";
import { PageContainer } from "@/components/site/PageContainer";
import { ProductSpecsPanel } from "@/components/site/ProductSpecsPanel";
import { resolveDetailPriceHistory } from "@/lib/productDetail";

type RelatedProduct = {
  name: string;
  brand: string;
  img: string;
  minPrice: number;
  slug: string;
  discount: number | null;
};

type Product = {
  name: string;
  brand: string;
  category: string;
  img: string;
  images?: string[] | null;
  reference?: string | null;
  minPrice: number;
  maxPrice: number;
  shopNames: string[];
  discount: number | null;
  slug: string;
  description: string | null;
  specs: Record<string, string> | null;
  shopUrls: Record<string, string> | null;
  shopPrices: Record<string, number> | null;
  priceHistory?: { date: string; prix: number }[];
  related: RelatedProduct[];
};

// Search URL patterns for each shop key — {q} is replaced with the encoded product name
const shopSearchUrls: Record<string, string> = {
  // ── Supermarché ────────────────────────────────────────────────────────────
  aziza:             "https://clusteraz.flesk.fr/recherche?query={q}",
  carrefour:         "https://www.carrefour.tn/recherche?q={q}",
  geant:             "https://www.geantdrive.tn/tunis-city/recherche?q={q}",
  monoprix:          "https://www.monoprix.tn/recherche?q={q}",
  "carrefour market":"https://www.carrefour.tn/recherche?q={q}",
  "carrefour express":"https://www.carrefour.tn/recherche?q={q}",
  // ── Retail / Tech ──────────────────────────────────────────────────────────
  mytek:             "https://www.mytek.tn/catalogsearch/result/?q={q}",
  spacenet:          "https://spacenet.tn/recherche?controller=search&s={q}",
  tunisianet:        "https://www.tunisianet.com.tn/recherche?controller=search&s={q}",
  technopro:         "https://www.technopro-online.com/recherche?controller=search&s={q}",
  affariyet:         "https://www.affariyet.com/recherche?controller=search&s={q}",
  tunewtec:          "https://tunewtec.com/?s={q}",
  jumbo:             "https://jumbo.tn/recherche?controller=search&s={q}",
  kamounhome:        "https://kamounhome.tn/?s={q}",
  zoom:              "https://zoom.com.tn/recherche?controller=search&s={q}",
  darty:             "https://www.darty.tn/recherche?controller=search&s={q}",
  itechstore:        "https://www.itechstore.tn/catalogsearch/result/?q={q}",
  scoop:             "https://www.scoopgaming.tn/recherche?controller=search&s={q}",
  sbs:               "https://www.sbsinformatique.com/search?q={q}",
  agora:             "https://agora.tn/fr/recherche?controller=search&s={q}",
  jmb:               "https://jmb.com.tn/?s={q}",
  wiki:              "https://wiki.tn/?s={q}",
  bill:              "https://bill.com.tn/?s={q}",
  bstech:            "https://bstech.tn/?s={q}",
  maalejaudio:       "https://maalejaudio.com/?s={q}",
  krichen:           "https://www.krichen-distribution.tn/?s={q}",
  taktek:            "https://taktek.tn/?s={q}",
  topbureau:         "https://topbureau.tn/?s={q}",
  emh:               "https://emh.com.tn/?s={q}",
  sigshop:           "https://sigshop.tn/?s={q}",
  // ── Parapharmacie ──────────────────────────────────────────────────────────
  mapara:            "https://www.mapara.tn/recherche?controller=search&s={q}",
  paraexpert:        "https://www.paraexpert.tn/recherche?controller=search&s={q}",
  parashop:          "https://parashop.tn/recherche?controller=search&s={q}",
  parafendri:        "https://parafendri.tn/recherche?controller=search&s={q}",
  el_farabi:         "https://www.pharmacie-elfarabi.tn/recherche?controller=search&s={q}",
  cosmetique:        "https://www.cosmetique.tn/recherche?controller=search&s={q}",
  beautystore:       "https://beautystore.tn/recherche?controller=search&s={q}",
  pharmashop:        "https://pharmashop.tn/recherche?controller=search&s={q}",
  parahouse:         "https://parahouse.tn/recherche?controller=search&s={q}",
  paraland:          "https://paraland.tn/recherche?controller=search&s={q}",
};

function shopUrl(shopKey: string, productName: string): string {
  const key = shopKey.toLowerCase().trim();
  const pattern = shopSearchUrls[key];
  if (!pattern) return `https://www.google.com/search?q=${encodeURIComponent(productName + " " + shopKey + " tunisie")}`;
  return pattern.replace("{q}", encodeURIComponent(productName));
}

function shopBadge(_name: string, isCheapest: boolean, isEqual: boolean) {
  if (isCheapest) {
    return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 ring-1 ring-emerald-500/30";
  }
  if (isEqual) {
    return "bg-sky-500/15 text-sky-600 dark:text-sky-300 ring-1 ring-sky-500/30";
  }
  return "bg-brand-gold/10 text-brand-gold ring-1 ring-brand-gold/25";
}

function PriceHistoryChart({ data }: { data: { date: string; prix: number }[] }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="catalogPriceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f6c453" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#f6c453" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={dark ? "#1f2740" : "#e2e8f0"} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: dark ? "#8a93ab" : "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={Math.max(0, Math.floor(data.length / 8))}
          />
          <YAxis
            tick={{ fill: dark ? "#8a93ab" : "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={[(min: number) => Math.floor(min * 0.97), (max: number) => Math.ceil(max * 1.03)]}
            width={60}
            tickFormatter={(v: number) => `${v.toFixed(0)}`}
          />
          <Tooltip
            contentStyle={{
              background: dark ? "#0f1422" : "#ffffff",
              border: `1px solid ${dark ? "#222b44" : "#e2e8f0"}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number) => [`${v.toLocaleString("fr-FR", { minimumFractionDigits: 3 })} DT`, "Prix"]}
            labelStyle={{ color: dark ? "#e6e8ee" : "#0f172a" }}
          />
          <Area
            type="monotone"
            dataKey="prix"
            stroke="#f6c453"
            strokeWidth={2.4}
            fill="url(#catalogPriceFill)"
            dot={false}
            activeDot={{ r: 5, stroke: "#f6c453", fill: dark ? "#0a0e1a" : "#ffffff", strokeWidth: 2 }}
            isAnimationActive
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function PriceBar({ min, max, current }: { min: number; max: number; current: number }) {
  const pct = max === min ? 100 : Math.round(((current - min) / (max - min)) * 100);
  const isMin = current === min;
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
      <span className="shrink-0 text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
        {min.toFixed(3)} DT
      </span>
      <div className="relative h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
        <div
          className={`absolute left-0 top-0 h-full rounded-full ${isMin ? "bg-emerald-500" : "bg-brand-gold"}`}
          style={{ width: `${Math.max(8, pct)}%` }}
        />
      </div>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-red-500 dark:text-red-400">
        {max.toFixed(3)} DT
      </span>
    </div>
  );
}

export function CatalogProductDetail({
  slug,
  apiBase,
  backHref,
  backLabel,
  comparatorBase,
}: {
  slug: string;
  apiBase: string;           // e.g. "/api/para-products" or "/api/retail-products"
  backHref: string;          // e.g. "/parapharmacie" or "/retail"
  backLabel: string;
  comparatorBase: string;    // prefix for related links e.g. "/parapharmacie" or "/retail"
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    fetch(`${apiBase}/${slug}`)
      .then(r => { if (!r.ok) throw new Error("not found"); return r.json(); })
      .then(setProduct)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug, apiBase]);

  const gallery = useMemo(() => {
    if (!product) return [] as string[];
    const all = [
      ...(product.images ?? []),
      ...(product.img ? [product.img] : []),
    ].filter(u => typeof u === "string" && u.startsWith("http"));
    return Array.from(new Set(all));
  }, [product]);

  const chartHistory = useMemo(
    () => (product ? resolveDetailPriceHistory(product.priceHistory, product.minPrice) : []),
    [product],
  );

  if (loading) return (
    <main className="min-h-screen bg-bg-900">
      <Header />
      <div className="flex h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-gold/30 border-t-brand-gold" />
      </div>
      <Footer />
    </main>
  );

  if (notFound || !product) return (
    <main className="min-h-screen bg-bg-900">
      <Header />
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Produit introuvable</h1>
        <p className="text-slate-500 dark:text-white/50 mb-6">Ce produit n'existe pas ou a été retiré.</p>
        <Link href={backHref} className="btn-primary">← Retour</Link>
      </div>
      <Footer />
    </main>
  );

  const savings = product.maxPrice - product.minPrice;
  const discountPct = product.discount;

  const shopRows = [...product.shopNames]
    .map((shop) => {
      const keyExact = shop;
      const keyLower = shop.toLowerCase();
      const keyUnder = keyLower.replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      const keyNoSep = keyLower.replace(/[^a-z0-9]/g, "");
      const p = product.shopPrices;
      const u = product.shopUrls;
      const price = p?.[keyUnder] ?? p?.[keyExact] ?? p?.[keyLower] ?? p?.[keyNoSep] ?? product.minPrice;
      const dbUrl = u?.[keyUnder] ?? u?.[keyExact] ?? u?.[keyLower] ?? u?.[keyNoSep];
      const href = dbUrl ?? shopUrl(shop, product.name);
      return { shop, price, href };
    })
    .sort((a, b) => a.price - b.price);

  // Multiple shops can genuinely tie on price — don't crown one "Moins cher"
  // over an identical price, mirroring the "Égalité" treatment on listing cards.
  const cheapestPrice = shopRows[0]?.price ?? null;
  const tiedForCheapest = cheapestPrice != null
    ? shopRows.filter((r) => Math.abs(r.price - cheapestPrice) <= 0.001).length
    : 0;
  const allShopsTied = tiedForCheapest > 1;

  const baseSpecs: [string, string][] = [
    ["Marque", product.brand],
    ["Catégorie", product.category],
    ...(product.reference ? [["Référence", product.reference] as [string, string]] : []),
    ["Prix min", `${product.minPrice.toFixed(3)} DT`],
    ...(discountPct ? [["Réduction", `−${discountPct}%`] as [string, string]] : []),
  ];

  return (
    <main className="min-h-screen bg-bg-900 pb-28">
      <Header />

      <PageContainer className="pt-5">
        <nav className="mb-6 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/40">
          <Link href="/" className="transition hover:text-brand-gold">Accueil</Link>
          <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
          <Link href={backHref} className="transition hover:text-brand-gold">{backLabel}</Link>
          <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
          <span className="truncate text-brand-gold">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[420px_1fr]">
          {/* Galerie — sticky on desktop */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="relative flex aspect-square max-h-[min(480px,70vw)] w-full items-center justify-center overflow-hidden rounded-2xl border border-bg-border bg-white p-6 dark:bg-gradient-to-br dark:from-white/[0.06] dark:via-white/[0.02] dark:to-transparent">
              <img
                src={gallery[activeImage] ?? product.img}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full object-contain transition duration-500 hover:scale-[1.02]"
              />
              {discountPct ? (
                <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-brand-red px-3 py-1 text-[12px] font-bold text-white shadow">
                  <Tag className="h-3 w-3" />−{discountPct}%
                </span>
              ) : null}
            </div>

            {gallery.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
                {gallery.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-white p-1 transition dark:bg-white/[0.04] ${
                      i === activeImage
                        ? "border-brand-gold ring-2 ring-brand-gold/30"
                        : "border-bg-border hover:border-brand-gold/40"
                    }`}
                    aria-label={`Image ${i + 1}`}
                  >
                    <img src={src} alt="" referrerPolicy="no-referrer" className="h-full w-full object-contain" />
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: ShieldCheck, label: "Prix vérifié" },
                { icon: Scale, label: "Comparé multi-boutiques" },
                { icon: Truck, label: "Livraison dispo" },
              ].map((b) => (
                <div
                  key={b.label}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-bg-border bg-bg-700 px-2 py-3 text-center"
                >
                  <b.icon className="h-4 w-4 text-brand-gold" strokeWidth={2} />
                  <span className="text-[10px] font-semibold leading-tight text-slate-600 dark:text-white/60">
                    {b.label}
                  </span>
                </div>
              ))}
            </div>
          </aside>

          {/* Contenu principal */}
          <div className="flex min-w-0 flex-col gap-6">
            <header className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-brand-gold/25 bg-brand-gold/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-brand-gold">
                  {product.brand}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/50">
                  {product.category}
                </span>
                {product.shopNames.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/50">
                    <Store className="h-3 w-3" />
                    {product.shopNames.length} boutique{product.shopNames.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-black leading-snug tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                {product.name}
              </h1>
              {product.reference && (
                <p className="text-xs text-slate-500 dark:text-white/45">
                  Réf. <span className="font-semibold tabular-nums">{product.reference}</span>
                </p>
              )}
            </header>

            {/* Prix + actions */}
            <div className="rounded-2xl border border-bg-border bg-bg-card p-5 shadow-card sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/40">
                    Meilleur prix
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-4xl font-black tabular-nums leading-none text-emerald-600 dark:text-emerald-400">
                      {product.minPrice.toFixed(3)}
                    </span>
                    <span className="pb-1 text-lg font-semibold text-slate-500 dark:text-white/50">DT</span>
                  </div>
                </div>
                {savings > 0.5 && (
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-center">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
                      Économie max
                    </div>
                    <div className="text-xl font-black tabular-nums text-emerald-600 dark:text-emerald-300">
                      {savings.toFixed(3)} DT
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/40">
                  Fourchette de prix
                </div>
                <PriceBar min={product.minPrice} max={product.maxPrice} current={product.minPrice} />
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={`/comparateur/${slug}?from=${comparatorBase.replace(/^\//, "")}`}
                  className="group relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-brand-gold via-brand-goldDark to-[#a77f24] px-5 py-3 text-sm font-bold text-bg-900 ring-1 ring-brand-gold/40 shadow-[0_4px_18px_-4px_rgba(246,196,83,0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_6px_24px_-2px_rgba(246,196,83,0.65)] active:translate-y-0"
                >
                  <Scale className="h-4 w-4 transition-transform duration-300 group-hover:rotate-[-8deg]" />
                  Comparer les prix
                </Link>
              </div>

              <FavoriteAlertButtons slug={slug} />
            </div>

            {/* Boutiques + historique */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="flex flex-col rounded-2xl border border-bg-border bg-bg-card p-5 shadow-card sm:p-6">
                <h2 className="section-title mb-4 flex items-center gap-2">
                  <Store className="h-4 w-4 shrink-0 text-brand-gold" />
                  {product.shopNames.length} boutique{product.shopNames.length > 1 ? "s" : ""}
                </h2>
                <ul className="flex-1 space-y-2">
                  {shopRows.map(({ shop, price, href }, i) => {
                    const isTiedCheapest = i < tiedForCheapest;
                    const isCheapest = isTiedCheapest && !allShopsTied;
                    const isEqual = isTiedCheapest && allShopsTied;
                    const highlighted = isCheapest || isEqual;
                    return (
                      <li key={shop}>
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ${
                            isCheapest
                              ? "border border-emerald-500/30 bg-emerald-500/10 hover:border-emerald-500/50 hover:bg-emerald-500/15"
                              : isEqual
                              ? "border border-sky-500/30 bg-sky-500/10 hover:border-sky-500/50 hover:bg-sky-500/15"
                              : "border border-slate-200 bg-slate-50 hover:border-brand-gold/40 hover:bg-brand-gold/5 dark:border-white/5 dark:bg-bg-800 dark:hover:border-brand-gold/40"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${shopBadge(shop, isCheapest, isEqual)}`}
                            >
                              {shop.charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <span
                                className={`block truncate text-sm font-semibold capitalize ${
                                  isCheapest
                                    ? "text-emerald-700 dark:text-emerald-300"
                                    : isEqual
                                    ? "text-sky-700 dark:text-sky-300"
                                    : "text-slate-800 dark:text-white/85"
                                }`}
                              >
                                {shop}
                              </span>
                              {isCheapest && (
                                <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                                  Moins cher
                                </span>
                              )}
                              {isEqual && (
                                <span className="text-[10px] font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                                  Égalité
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span
                              className={`text-right text-sm font-extrabold tabular-nums ${
                                highlighted
                                  ? isCheapest
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-sky-600 dark:text-sky-400"
                                  : "text-slate-900 dark:text-white"
                              }`}
                            >
                              {price.toFixed(3)}
                              <span className="ml-0.5 text-[10px] font-normal text-slate-400 dark:text-white/40">DT</span>
                            </span>
                            <ExternalLink className="h-3.5 w-3.5 text-slate-300 dark:text-white/25" />
                          </div>
                        </a>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-4 flex items-center gap-1.5 rounded-xl border border-brand-gold/20 bg-brand-gold/5 px-3 py-2.5 text-[11px] leading-snug text-slate-600 dark:text-white/60">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-gold" />
                  Prix mis à jour quotidiennement par 1111.tn.
                </p>
              </div>

              <div className="flex flex-col rounded-2xl border border-bg-border bg-bg-card p-5 shadow-card sm:p-6">
                <h2 className="section-title mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 shrink-0 text-brand-gold" />
                  Historique (7 jours)
                </h2>
                <div className="flex flex-1 flex-col justify-center">
                  {chartHistory.length > 1 ? (
                    <>
                      <PriceHistoryChart data={chartHistory} />
                      {chartHistory.every((p) => p.prix === chartHistory[0]?.prix) && (
                        <p className="mt-3 text-center text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          Prix stable · {product.minPrice.toFixed(3)} DT
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-center">
                      <TrendingUp className="h-8 w-8 text-slate-300 dark:text-white/15" />
                      <p className="max-w-[14rem] text-[12px] leading-relaxed text-slate-400 dark:text-white/35">
                        L&apos;historique sera disponible après quelques jours de suivi.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Description + caractéristiques */}
            <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-bg-border bg-bg-card p-5 shadow-card sm:p-6">
                <h2 className="section-title mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-brand-gold" />
                  Description
                </h2>
                {product.description ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-white/70">
                    {product.description}
                  </p>
                ) : (
                  <div className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-white/70">
                    <p>
                      <span className="font-semibold text-slate-900 dark:text-white">{product.name}</span>
                      {" "}({product.brand}) — catégorie{" "}
                      <span className="font-semibold text-slate-900 dark:text-white">{product.category}</span>.
                      Comparé sur{" "}
                      <span className="font-semibold text-brand-gold">{product.shopNames.length}</span>
                      {" "}boutique{product.shopNames.length > 1 ? "s" : ""}.
                    </p>
                    {savings > 0.5 && (
                      <p>
                        Économie possible jusqu&apos;à{" "}
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {savings.toFixed(3)} DT
                        </span>.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <ProductSpecsPanel baseSpecs={baseSpecs} techSpecs={product.specs} />
            </div>

            {product.related.length > 0 && (
              <section className="pt-2">
                <h2 className="section-title mb-4">Produits similaires</h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {product.related.map((r) => (
                    <Link
                      key={r.slug}
                      href={`${comparatorBase}/${r.slug}`}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-brand-gold/30 hover:shadow-lg dark:border-white/[0.06] dark:bg-white/[0.025]"
                    >
                      <div className="relative aspect-square overflow-hidden bg-slate-50 dark:bg-white/[0.04]">
                        <img
                          src={r.img}
                          alt={r.name}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-contain p-3 transition duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                        {r.discount ? (
                          <span className="absolute left-2 top-2 rounded-full bg-brand-red px-2 py-0.5 text-[10px] font-black text-white">
                            −{r.discount}%
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-1 flex-col p-3">
                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">
                          {r.brand}
                        </div>
                        <div className="line-clamp-2 flex-1 text-[12px] font-bold leading-snug text-slate-900 dark:text-white">
                          {r.name}
                        </div>
                        <div className="mt-2 text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                          {r.minPrice.toFixed(3)} DT
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </PageContainer>

      <Link
        href={backHref}
        className="group/back fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-full border border-bg-border bg-bg-card/95 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-lg backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-brand-gold/50 hover:text-brand-gold hover:shadow-[0_8px_28px_-6px_rgba(246,196,83,0.4)] active:translate-y-0 dark:text-white/80"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover/back:-translate-x-1" />
        {backLabel}
      </Link>

      <Footer />
    </main>
  );
}
