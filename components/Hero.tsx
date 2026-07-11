"use client";
import { useEffect, useState } from "react";
import { BarChart3, Flame, Package, Search, TrendingUp } from "lucide-react";
import Link from "next/link";
import { GrocerySupermarketBars } from "./GrocerySupermarketBars";
import { SearchModal } from "./SearchModal";
import type { GroceryShopHealth } from "@/lib/groceryCrossing";

const tags = ["climatiseur", "iphone 15", "samsung", "machine à laver", "parfum", "laptop"];

type MarketData = {
  index: number;
  yesterdayIndex: number;
  topShops: { name: string; promos: number }[];
  stats: {
    totalProducts: number;
    totalPrices: number;
    totalPromos: number;
    totalSavingsDT: number;
    totalShops: number;
    avgDiscountPct: number;
    breakdown?: {
      alimentation: { products: number; promos: number; savingsDT: number };
      para: { products: number; promos: number; savingsDT: number };
      retail: { products: number; promos: number; savingsDT: number };
    };
  };
};

type GroceryCrossingPayload = {
  summary: { crossed_products: number; shops: number; products: number };
  featured_shops: GroceryShopHealth[];
};

const FALLBACK_GROCERY: GroceryCrossingPayload = {
  summary: { crossed_products: 23820, shops: 7, products: 75787 },
  featured_shops: [],
};

const FALLBACK: MarketData = {
  index: 100,
  yesterdayIndex: 99,
  topShops: [],
  stats: {
    totalProducts: 352212, totalPrices: 159011, totalPromos: 26080,
    totalSavingsDT: 1414956, totalShops: 0, avgDiscountPct: 17.9,
    breakdown: {
      alimentation: { products: 99873, promos: 0, savingsDT: 0 },
      para: { products: 0, promos: 0, savingsDT: 0 },
      retail: { products: 0, promos: 0, savingsDT: 0 },
    },
  },
};


export function Hero() {
  const [data, setData]             = useState<MarketData>(FALLBACK);
  const [grocery, setGrocery]       = useState<GroceryCrossingPayload>(FALLBACK_GROCERY);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchSeed, setSearchSeed] = useState("");

  const openSearch = (seed = "") => {
    setSearchSeed(seed);
    setSearchOpen(true);
  };

  useEffect(() => {
    fetch("/api/market-index")
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j && j.index) setData({ ...j, stats: { ...j.stats, totalProducts: 352_212 } }); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/stats/grocery-crossing")
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (j?.summary && j?.featured_shops?.length) {
          setGrocery({ summary: j.summary, featured_shops: j.featured_shops });
        }
      })
      .catch(() => {});
  }, []);

  // ⌘K / Ctrl+K opens search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const current = data.index;
  const change  = +(((current - data.yesterdayIndex) / data.yesterdayIndex) * 100).toFixed(2);
  const up      = change >= 0;

  const stats = [
    {
      value: data.stats.totalProducts.toLocaleString("fr-TN"),
      label: "Produits suivis",
      desc: "Références uniques indexées en supermarché, parapharmacie et retail",
      icon: Package, color: "text-brand-gold",
    },
    {
      value: data.stats.totalPromos.toLocaleString("fr-TN"),
      label: "Promotions actives",
      desc: "Offres où le prix affiché est inférieur au prix de référence en ce moment",
      icon: Flame, color: "text-red-400",
    },
    {
      value: data.stats.avgDiscountPct + "%",
      label: "Réduction moyenne",
      desc: "Rabais moyen constaté sur toutes les promotions actives dans nos bases",
      icon: BarChart3, color: "text-yellow-400",
    },
  ];

  return (
    <section className="mx-auto max-w-[1600px] px-3 pt-4 sm:px-4 sm:pt-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr] lg:gap-5">
        {/* Left: mascot + headline + search */}
        <div className="relative overflow-hidden rounded-2xl border border-bg-border bg-gradient-to-br from-slate-50 to-white p-4 sm:p-6 md:p-8 dark:from-bg-700 dark:to-bg-800">
          <div className="absolute -left-6 -bottom-6 h-48 w-48 rounded-full bg-brand-red/15 blur-3xl" />
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-brand-gold/10 blur-3xl" />
          <div className="relative flex flex-row items-center gap-3 md:gap-5">
            <div className="shrink-0">
              <Mascot />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h1 className="text-base sm:text-xl md:text-3xl lg:text-4xl font-black leading-[1.05] tracking-tight text-slate-900 dark:text-white">
                VÉRIFIEZ AVANT D'ACHETER,
                <br />
                <span className="gradient-text-gold">ÉCONOMISEZ PLUS !</span>
              </h1>
              <p className="mt-1 md:mt-2 font-arabic text-right text-sm sm:text-base md:text-xl text-slate-700 dark:text-white/90" dir="rtl">
                ثبت قبل ما تشري، وفر أكثر ! 
              </p>
              <p className="mt-1 md:mt-3 text-[11px] sm:text-xs md:text-sm text-slate-600 dark:text-white/70">
                Comparez plus de <span className="text-slate-900 font-semibold dark:text-white">350 000 produits</span>,
                surveillez les prix, détectez les vraies promotions et économisez sur tous vos achats.
              </p>

              <button
                type="button"
                onClick={() => openSearch()}
                className="group mt-2 md:mt-4 flex w-full items-center gap-1 sm:gap-2 rounded-2xl border border-slate-300 bg-white p-1 sm:p-1.5 text-left shadow-inner transition hover:border-brand-gold/50 hover:shadow-[0_0_0_3px_rgba(246,196,83,0.12)] dark:border-bg-border dark:bg-bg-900 dark:hover:border-brand-gold/40"
              >
                <Search className="ml-1 h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 shrink-0 text-slate-400 transition group-hover:text-brand-gold dark:text-white/50" />
                <span className="min-w-0 flex-1 truncate px-1 py-1 sm:py-2 text-[11px] sm:text-xs md:text-sm text-slate-400 dark:text-white/40">
                  Titre, marque ou référence SKU…
                </span>
                <kbd className="mr-1 hidden shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 sm:inline-block dark:border-white/10 dark:bg-white/5 dark:text-white/50">
                  ⌘K
                </kbd>
                <span className="btn-gold whitespace-nowrap px-2 py-1 text-[10px] sm:px-3 sm:py-1.5 sm:text-xs md:px-4 md:py-2 md:text-sm">Rechercher</span>
              </button>

              <div className="mt-2 md:mt-3 flex flex-wrap justify-start gap-1 sm:gap-1.5 md:gap-2">
                {tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => openSearch(t)}
                    className="chip"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: market index card */}
        <div className="card card-pad relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-gold" />
              <span className="section-title">Indice du marché ✦</span>
            </div>
            <Link href="/indice" className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 transition hover:border-emerald-400/60 dark:text-emerald-300">
              En temps réel
            </Link>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-slate-900 tabular-nums transition-all duration-500 dark:text-white">
              {grocery.summary.crossed_products.toLocaleString("fr-TN")}
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-sm font-bold text-slate-700 dark:text-white/80">produits croisés</span>
              <span className="text-xs text-slate-500 dark:text-white/50">
                comparables sur{" "}
                <span className="font-semibold text-slate-700 dark:text-white/70">
                  {grocery.summary.shops} enseignes
                </span>
              </span>
            </div>
          </div>

          <div className="mt-1">
            {grocery.featured_shops.length > 0 ? (
              <GrocerySupermarketBars
                shops={grocery.featured_shops}
                detailHref="/supermarche/classement"
              />
            ) : (
              <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
            )}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {stats.map((s) => (
              <div
                key={s.label}
                title={s.desc}
                className="group rounded-xl border border-slate-200 bg-slate-50 p-3 hover:border-slate-300 transition dark:border-bg-border dark:bg-bg-800 dark:hover:border-white/15 cursor-default"
              >
                <div className={`flex items-center justify-between ${s.color}`}>
                  <span className="text-xl font-extrabold tabular-nums">{s.value}</span>
                  <s.icon className="h-4 w-4 opacity-80" />
                </div>
                <div className="mt-1 text-[11px] font-semibold leading-tight text-slate-700 dark:text-white/80">{s.label}</div>
                <div className="mt-0.5 text-[10px] leading-tight text-slate-400 dark:text-white/35">{s.desc}</div>
              </div>
            ))}
          </div>

          <Link href="/supermarche/classement" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-gold transition hover:gap-2 hover:underline">
            Voir le classement courses →
          </Link>
        </div>
      </div>

      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        initialQuery={searchSeed}
      />
    </section>
  );
}

function Mascot() {
  return (
    <div className="relative h-20 w-20 sm:h-28 sm:w-28 md:h-40 md:w-40 lg:h-56 lg:w-56 xl:h-72 xl:w-72 2xl:h-96 2xl:w-96">
      <div className="absolute inset-0 -z-10 animate-pulse-slow rounded-full bg-brand-red/20 blur-2xl" />
      <img
        src="/mascot.png"
        alt="Mascotte 1111.tn"
        className="mascot-anim h-full w-full object-contain"
      />
    </div>
  );
}
