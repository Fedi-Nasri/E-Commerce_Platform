"use client";

import { useEffect, useState } from "react";
import { Store, Sparkles, ShoppingCart, Loader2, ChevronLeft, Trophy } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ShopFlipCard, type ShopStat } from "@/components/ShopFlipCard";

type Category = "retail" | "parapharmacie" | "supermarche";

const CATEGORIES: {
  id: Category;
  fr: string;
  ar: string;
  icon: any;
  accent: string;
  activeBg: string;
  activeText: string;
  activeBorder: string;
}[] = [
  {
    id: "retail",
    fr: "Magasins",
    ar: "المتاجر",
    icon: Store,
    accent: "blue",
    activeBg: "bg-blue-500/10",
    activeText: "text-blue-700 dark:text-blue-300",
    activeBorder: "border-blue-500/40",
  },
  {
    id: "parapharmacie",
    fr: "Parapharmacie",
    ar: "شبه الصيدلية",
    icon: Sparkles,
    accent: "rose",
    activeBg: "bg-rose-500/10",
    activeText: "text-rose-700 dark:text-rose-300",
    activeBorder: "border-rose-500/40",
  },
  {
    id: "supermarche",
    fr: "Supermarché",
    ar: "السوبرماركت",
    icon: ShoppingCart,
    accent: "emerald",
    activeBg: "bg-emerald-500/10",
    activeText: "text-emerald-700 dark:text-emerald-300",
    activeBorder: "border-emerald-500/40",
  },
];

const CATEGORY_LABELS: Record<Category, string> = {
  retail: "Retail",
  parapharmacie: "Parapharmacie",
  supermarche: "Supermarché",
};

const SKELETON_SHOPS = Array.from({ length: 6 }).map((_, i) => ({
  shop: `skel-${i}`,
  displayName: "—",
  logo: null,
  rank: i + 1,
  totalProducts: 0,
  cheapestCount: 0,
}));

export default function ClassementPage() {
  const [category, setCategory] = useState<Category>("retail");
  const [shops, setShops] = useState<Record<Category, ShopStat[]>>({
    retail: [],
    parapharmacie: [],
    supermarche: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats/classement-shops")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setShops({
          retail: d.retail ?? [],
          parapharmacie: d.parapharmacie ?? [],
          supermarche: d.supermarche ?? [],
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentShops = shops[category];
  const displayShops = loading ? SKELETON_SHOPS : currentShops;

  return (
    <main className="min-h-screen bg-bg-900">
      <Header />

      {/* ── Hero ── */}
      <div className="mx-auto w-full max-w-[1600px] px-3 pt-5 sm:px-4">
        <nav className="reveal-up mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/40">
          <Link href="/" className="transition hover:text-brand-gold">Accueil</Link>
          <ChevronLeft className="h-3 w-3 rotate-180" />
          <span className="text-brand-gold">Classement</span>
        </nav>

        <div
          className="reveal-up relative overflow-hidden rounded-2xl border border-bg-border bg-gradient-to-br from-bg-700 to-bg-800 p-5 sm:p-7"
          style={{ animationDelay: "0.06s" }}
        >
          <div className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-brand-red/15 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-44 w-44 rounded-full bg-brand-gold/10 blur-3xl" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-gold/25 to-brand-gold/5 ring-1 ring-brand-gold/30 shadow-[0_0_30px_-8px_rgba(246,196,83,0.5)] sm:h-14 sm:w-14">
                <Trophy className="h-6 w-6 text-brand-gold sm:h-7 sm:w-7" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <h1 className="text-xl font-black leading-[1.08] tracking-tight text-slate-900 sm:text-3xl md:text-4xl dark:text-white">
                  Classement <span className="gradient-text-gold">des enseignes</span>
                </h1>
                <p className="mt-1 font-arabic text-base text-slate-500 dark:text-white/55" dir="rtl">ترتيب المتاجر</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {CATEGORIES.map((c) => {
                const count = loading ? "—" : (shops[c.id]?.length ?? 0).toString();
                return (
                  <div
                    key={c.id}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 transition-colors ${
                      category === c.id
                        ? "border-brand-gold/25 bg-brand-gold/10 text-brand-gold"
                        : "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/50"
                    }`}
                  >
                    <span className="text-xl font-black leading-none tabular-nums">{count}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{c.fr}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="relative mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-white/70">
            Comparez les enseignes par catégorie. Cliquez sur une carte pour révéler ses statistiques détaillées.
          </p>

          <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-brand-gold/40 to-transparent" />
        </div>
      </div>

      {/* ── Tabs + grid ── */}
      <div className="mx-auto w-full max-w-[1600px] mt-5 px-3 pb-10 sm:px-4 sm:mt-6 sm:pb-14">
        {/* Tabs */}
        <div className="reveal-up mb-6 flex flex-wrap items-center gap-2" style={{ animationDelay: "0.12s" }}>
          {CATEGORIES.map((c) => {
            const active = category === c.id;
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`group flex items-center gap-2.5 rounded-xl border px-4 py-2.5 transition-all duration-200 ${
                  active
                    ? `${c.activeBorder} ${c.activeBg} ${c.activeText} shadow-sm`
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60 dark:hover:border-white/20"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "" : "opacity-60 group-hover:opacity-100"}`} strokeWidth={2.2} />
                <span className="text-sm font-bold">{c.fr}</span>
                {!loading && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums ${
                    active ? "bg-white/25 dark:bg-white/10" : "bg-slate-100 dark:bg-white/10"
                  }`}>
                    {shops[c.id]?.length ?? 0}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading && (
          <div className="mb-4 flex items-center gap-2 text-sm text-slate-400 dark:text-white/40">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement des enseignes…
          </div>
        )}

        {!loading && displayShops.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 py-16 text-center text-sm text-slate-400 dark:border-white/10 dark:bg-bg-card/40 dark:text-white/40">
            Aucune enseigne disponible pour {CATEGORY_LABELS[category]} pour le moment.
          </div>
        )}

        {/* Grid */}
        {displayShops.length > 0 && (
          <div
            key={category}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {displayShops.map((shop, i) => (
              <div
                key={`${category}-${shop.shop}`}
                className="reveal-up"
                style={{ animationDelay: `${Math.min(i * 50, 500)}ms` }}
              >
                {loading ? (
                  <div className="h-[340px] animate-pulse rounded-2xl border border-bg-border bg-bg-card" />
                ) : (
                  <ShopFlipCard shop={shop} category={CATEGORY_LABELS[category]} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
