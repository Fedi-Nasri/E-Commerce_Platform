"use client";
import { ChevronRight, ShieldAlert, Store, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EssentialBasketRanking } from "@/components/EssentialBasketRanking";
import { fmtDt, getEssentialBasketData } from "@/lib/essentialBasket";
import { topRetailSites, retailSitesMonth } from "@/lib/topRetailSites";
import { RetailSitesSourceAttribution } from "@/components/site/RetailSitesSourceAttribution";

// favicon for a domain (Google's service, themed-neutral, cached by browser)
function faviconFor(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}
// "tunisianet.com.tn" -> "Tunisianet"
function siteName(domain: string): string {
  const base = domain.replace(/\.(com\.tn|co\.uk|com|tn|fr|de|ae|ca|qa|net|to|co)$/i, "").split(".")[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

type IllogicalPromo = {
  productId: number;
  name: string;
  slug: string;
  shop: string;
  shopProductUrl: string;
  img: string | null;
  currentPrice: string;
  regularPrice: string;
  marketMin: string;
  marketMax: string;
  claimedDiscount: string;
  realDiscount: string;
  currentPriceRaw: number;
  marketMinRaw: number;
  href: string;
};

type RetailShopRow = {
  shop: string;
  displayName: string;
  logo: string | null;
  totalProducts: number;
  similarProducts: number;
  cheapestCount: number;
  winRatePct?: number;
  competitivePct?: number;
};

type RetailMeta = {
  clustersUsed: number;
  scrapesUsed: number | null;
};

function TopRetailRankRow({
  shop,
  rank,
  animate,
}: {
  shop: RetailShopRow;
  rank: number;
  animate: boolean;
}) {
  const winPct =
    shop.winRatePct ??
    (shop.totalProducts > 0 ? Math.round((shop.cheapestCount / shop.totalProducts) * 100) : 0);
  const isChampion = rank === 0;

  return (
    <li
      className={`retail-row-enter rounded-xl border border-slate-200/90 bg-slate-50/90 p-2.5 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-400/35 hover:shadow-md hover:shadow-emerald-500/10 dark:border-white/5 dark:bg-bg-800 dark:hover:border-emerald-500/25 ${
        isChampion ? "retail-champion-glow border-emerald-400/30 dark:border-emerald-500/30" : ""
      }`}
      style={{ animationDelay: animate ? `${rank * 70}ms` : "0ms" }}
    >
      <div className="flex items-center gap-3">
        {shop.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shop.logo}
            alt={shop.displayName}
            className="h-14 w-14 shrink-0 object-contain"
          />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center text-lg font-black text-slate-500 dark:text-white/60">
            {shop.displayName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-slate-900 dark:text-white">{shop.displayName}</div>
          <div className="text-[10px] tabular-nums text-slate-500 dark:text-white/50">
            {shop.cheapestCount.toLocaleString("fr-FR")}
            <span className="mx-0.5 text-slate-400">/</span>
            {shop.totalProducts.toLocaleString("fr-FR")}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-black tabular-nums leading-none text-emerald-600 dark:text-emerald-400">{winPct}%</div>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
        <div
          className={`h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 ${animate ? "retail-win-bar" : ""}`}
          style={{
            width: `${winPct}%`,
            animationDelay: animate ? `${rank * 70 + 120}ms` : undefined,
          }}
        />
      </div>
    </li>
  );
}

function shortShopLabel(name: string) {
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.length <= 7) return clean;
  return clean.split(" ")[0].slice(0, 7);
}

function TopRetailBarChart({
  shops,
  animate,
}: {
  shops: RetailShopRow[];
  animate: boolean;
}) {
  const max = Math.max(...shops.map((s) => s.cheapestCount), 1);
  const totalWins = shops.reduce((sum, s) => sum + s.cheapestCount, 0);
  const leader = shops[0];

  return (
    <div className="retail-row-enter flex flex-1 flex-col rounded-xl border border-emerald-500/20 bg-gradient-to-b from-emerald-50/80 to-white/60 p-3 dark:from-emerald-950/40 dark:to-bg-800/80 dark:border-emerald-500/15">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          Meilleurs prix
        </span>
        <span className="text-[10px] tabular-nums text-slate-500 dark:text-white/45">
          {totalWins.toLocaleString("fr-FR")} au total
        </span>
      </div>

      <div className="mt-3 flex h-[5.5rem] items-end justify-between gap-1.5">
        {shops.map((s, i) => {
          const h = Math.max(12, Math.round((s.cheapestCount / max) * 100));
          const winPct =
            s.winRatePct ??
            (s.totalProducts > 0 ? Math.round((s.cheapestCount / s.totalProducts) * 100) : 0);
          return (
            <div key={s.shop} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-[9px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {winPct}%
              </span>
              <div className="relative flex h-16 w-full items-end justify-center">
                <div
                  className={`w-[85%] max-w-10 rounded-t-md bg-gradient-to-t from-emerald-600 via-emerald-500 to-emerald-300 shadow-[0_-2px_12px_rgba(16,185,129,0.25)] ${animate ? "retail-col-grow" : ""}`}
                  style={{
                    height: `${h}%`,
                    animationDelay: animate ? `${i * 90 + 200}ms` : undefined,
                  }}
                  title={`${s.displayName}: ${s.cheapestCount.toLocaleString("fr-FR")} meilleurs prix`}
                />
              </div>
              <span className="w-full truncate text-center text-[8px] font-medium text-slate-500 dark:text-white/45">
                {shortShopLabel(s.displayName)}
              </span>
            </div>
          );
        })}
      </div>

      {leader ? (
        <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-lg bg-white/70 px-1.5 py-1.5 ring-1 ring-slate-200/80 dark:bg-white/5 dark:ring-white/10">
            <div className="text-[9px] text-slate-500 dark:text-white/45">Leader</div>
            <div className="truncate text-[10px] font-bold text-slate-800 dark:text-white">{leader.displayName}</div>
          </div>
          <div className="rounded-lg bg-white/70 px-1.5 py-1.5 ring-1 ring-slate-200/80 dark:bg-white/5 dark:ring-white/10">
            <div className="text-[9px] text-slate-500 dark:text-white/45">Meilleurs prix</div>
            <div className="text-[10px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {leader.cheapestCount.toLocaleString("fr-FR")}
            </div>
          </div>
          <div className="rounded-lg bg-white/70 px-1.5 py-1.5 ring-1 ring-slate-200/80 dark:bg-white/5 dark:ring-white/10">
            <div className="text-[9px] text-slate-500 dark:text-white/45">Taux #1</div>
            <div className="text-[10px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {(leader.winRatePct ??
                (leader.totalProducts > 0
                  ? Math.round((leader.cheapestCount / leader.totalProducts) * 100)
                  : 0))}%
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function GrandeDistribRow() {
  const basket = getEssentialBasketData().fiveShop;
  const illogicalPromo = null as IllogicalPromo | null;
  const [topRetailShops, setTopRetailShops] = useState<RetailShopRow[]>([]);
  const [retailMeta, setRetailMeta] = useState<RetailMeta | null>(null);
  const [retailReady, setRetailReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats/top-retail-shops")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (Array.isArray(d?.shops)) setTopRetailShops(d.shops as RetailShopRow[]);
        if (d?.meta) {
          setRetailMeta({
            clustersUsed: Number(d.meta.clustersUsed) || 0,
            scrapesUsed: d.meta.scrapesUsed != null ? Number(d.meta.scrapesUsed) : null,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) requestAnimationFrame(() => setRetailReady(true));
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="mx-auto mt-6 max-w-[1600px] px-3 sm:px-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_0.85fr_0.85fr]">
        {/* GRANDE DISTRIBUTION */}
        <div className="card card-pad relative overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-base font-black uppercase tracking-wide text-brand-gold">Grande Distribution</span>
                <span className="font-arabic text-sm font-semibold text-brand-gold/80" dir="rtl">مقارنة السوبرماركات</span>
              </div>
            </div>
          </div>

          {/* Ranking + savings visual below */}
          <div className="mt-3">
            <EssentialBasketRanking
              compact
              showEconomy={false}
              footer={
                <div className="mt-4 border-t border-slate-200/80 pt-4 dark:border-emerald-500/20">
                  <div className="flex flex-col items-center gap-4 rounded-2xl bg-gradient-to-br from-slate-50/90 via-white to-emerald-50/40 p-4 ring-1 ring-slate-200/60 dark:from-emerald-950/50 dark:via-emerald-900/35 dark:to-slate-900/80 dark:ring-emerald-500/35 sm:flex-row sm:items-center sm:justify-center sm:gap-8 sm:p-5">
                    <img
                      src="/kathya.png"
                      alt="Panier de courses"
                      className="h-24 w-24 shrink-0 object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)] sm:h-28 sm:w-28"
                    />
                    <div className="w-full max-w-[14rem] rounded-xl border border-emerald-500/25 bg-white/90 px-5 py-4 text-center shadow-sm backdrop-blur-sm dark:border-emerald-400/50 dark:bg-gradient-to-br dark:from-emerald-900/90 dark:via-emerald-950/95 dark:to-slate-950/90 dark:shadow-[0_0_0_1px_rgba(52,211,153,0.15)]">
                      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-200">
                        Économie possible
                      </div>
                      <div className="mt-1.5 text-3xl font-black tabular-nums leading-none text-emerald-600 dark:text-emerald-300">
                        {fmtDt(basket.maxSavings)} DT
                      </div>
                      <div className="mt-2 text-[11px] font-medium text-slate-500 dark:text-emerald-100/75">
                        vs l&apos;enseigne la plus chère
                      </div>
                    </div>
                  </div>
                </div>
              }
            />
          </div>
        </div>

        {/* SITES LES PLUS VISITÉS — top retail websites in Tunisia */}
        <div className="card card-pad">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span className="section-title">Sites les plus visités</span>
            </div>
            <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">
              Top 8
            </span>
          </div>
          <div className="font-arabic text-[11px] text-slate-400 dark:text-white/50" dir="rtl">
            المواقع الأكثر زيارة
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-white/55">
            Les sites e-commerce les plus consultés en Tunisie · <span className="font-semibold text-slate-700 dark:text-white/80">{retailSitesMonth}</span>
          </div>

          <RetailSitesSourceAttribution variant="footer" className="mt-3" />

          <ul className="mt-3 space-y-2">
            {topRetailSites.slice(0, 8).map((s, i) => {
              const up = s.mom.includes("↑");
              const rankBg =
                i === 0 ? "bg-gradient-to-br from-yellow-400 to-amber-600 text-yellow-950" :
                i === 1 ? "bg-gradient-to-br from-slate-300 to-slate-500 text-slate-900" :
                i === 2 ? "bg-gradient-to-br from-orange-400 to-orange-700 text-orange-50" :
                          "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-white/70";
              const maxVisits = topRetailSites[0]?.visitsNum || 1;
              const barPct = (s.visitsNum / maxVisits) * 100;
              return (
                <li key={s.domain} className="rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/5 dark:bg-bg-800">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black shadow-sm ${rankBg}`}>
                      {i + 1}
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1 ring-1 ring-slate-200 dark:ring-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={faviconFor(s.domain)} alt={s.domain} referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-contain" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-slate-900 dark:text-white">{siteName(s.domain)}</div>
                      <div className="truncate text-[10px] text-slate-500 dark:text-white/55">{s.domain}</div>
                    </div>
                    <div className="text-right leading-tight">
                      <div className="text-base font-black tabular-nums text-amber-600 dark:text-amber-300">{s.visits}</div>
                      <div className={`flex items-center justify-end gap-0.5 text-[9px] font-bold ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                        {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                        {s.mom.replace(/[↑↓]/g, "")}
                      </div>
                    </div>
                  </div>
                  {/* Mini visits bar */}
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 transition-all"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <Link href="/sites-les-plus-visites" className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 py-2 text-center text-xs font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20">
            Voir le classement complet
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* TOP 5 RETAIL CHEAPEST */}
        <div className="card card-pad relative flex flex-col overflow-hidden border-emerald-500/30">
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/40">
                <Store className="h-3.5 w-3.5 text-emerald-500" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Top 5 retail
              </span>
            </div>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-300">
              En stock
            </span>
          </div>

          <p className="relative mt-1.5 text-[10px] leading-snug text-slate-500 dark:text-white/50">
            Enseignes qui affichent le plus souvent le{" "}
            <span className="font-medium text-slate-600 dark:text-white/70">meilleur prix</span>
            {" "}sur des produits identiques en stock (≥2 boutiques).
          </p>

          <ul className="relative mt-2.5 space-y-1.5">
            {(topRetailShops.length > 0 ? topRetailShops : Array.from({ length: 5 }).map((_, i) => ({
              shop: `shop-${i}`,
              displayName: "—",
              logo: null,
              totalProducts: 0,
              similarProducts: 0,
              cheapestCount: 0,
              winRatePct: 0,
            }))).slice(0, 5).map((s, i) => (
              <TopRetailRankRow key={s.shop} shop={s} rank={i} animate={retailReady && topRetailShops.length > 0} />
            ))}
          </ul>

          <div className="relative mt-2.5 flex min-h-[11rem] flex-1 flex-col gap-2">
            {retailMeta ? (
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {retailMeta.clustersUsed.toLocaleString("fr-FR")} produits comparés
                </span>
                {retailMeta.scrapesUsed ? (
                  <span className="rounded-full border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[9px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/55">
                    {retailMeta.scrapesUsed} boutiques scrappées
                  </span>
                ) : null}
              </div>
            ) : null}

            <TopRetailBarChart
              shops={(topRetailShops.length > 0 ? topRetailShops : Array.from({ length: 5 }).map((_, i) => ({
                shop: `shop-${i}`,
                displayName: "—",
                logo: null,
                totalProducts: 0,
                similarProducts: 0,
                cheapestCount: 0,
                winRatePct: 0,
              }))).slice(0, 5)}
              animate={retailReady && topRetailShops.length > 0}
            />
          </div>

          <div className="relative pt-2.5">
            <Link href="/classement-retail" className="btn-primary w-full">
              Voir le classement détaillé
            </Link>
          </div>
        </div>

        {/* PROMOTIONS ILLOGIQUES DÉTECTÉES */}
        <div
          data-home-card=""
          className="relative flex flex-col overflow-hidden rounded-2xl border border-red-200 bg-white dark:border-red-800/60 dark:bg-[#0d1117]"
        >
          {/* Red corner glow (dark only) */}
          <div className="pointer-events-none absolute -bottom-10 -right-10 h-48 w-48 rounded-full bg-red-700/25 blur-3xl dark:opacity-100 opacity-0" />
          <div className="pointer-events-none absolute -left-6 bottom-1/3 h-32 w-32 rounded-full bg-red-900/30 blur-2xl dark:opacity-100 opacity-0" />

          {/* Title block */}
          <div className="relative px-4 pt-4 pb-3 sm:px-5 sm:pt-5">
            <div className="text-lg font-black uppercase leading-tight text-red-600 dark:text-red-500">
              Promotions illogiques détectées
            </div>
            <div className="font-arabic mt-4 text-sm font-semibold text-red-500 dark:text-red-400" dir="rtl">
              عروض غير منطقية تم اكتشافها
            </div>
          </div>

          {/* Product area */}
          <div className="relative flex flex-1 flex-col px-4 sm:px-5">
            {/* Image — pleine largeur, en haut */}
            <div className="group/image relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-100 via-white to-slate-200/70 py-4 shadow-inner dark:border-white/10 dark:from-slate-800/80 dark:via-slate-700/40 dark:to-slate-900/80">
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-white/25 dark:from-black/20 dark:to-transparent" />
              <img
                src={illogicalPromo?.img ?? "https://jumbo.tn/4425-large_default/tv-hisense-l5g-series-100-uhd-4k-smart-laser-tv-android-wifi.jpg"}
                alt={illogicalPromo?.name ?? "TV Hisense L5G 100\""}
                className="relative z-[1] max-h-44 w-full object-contain px-2 drop-shadow-[0_8px_20px_rgba(15,23,42,0.25)] transition-transform duration-500 group-hover/image:scale-[1.03] dark:drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
              />
            </div>

            {/* Détails sous l'image */}
            <div className="mt-8 space-y-2">
              <div className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 dark:text-white">
                {illogicalPromo?.name ?? "TV Hisense L5G 100\" UHD 4K Smart Laser TV"}
              </div>
              <div className="text-xs text-slate-500 dark:text-white/60">{illogicalPromo?.shop ?? "Kamounhome"}</div>
              <div className="text-xs text-slate-500 dark:text-white/60">
                Prix affiché : <span className="font-medium text-slate-900 dark:text-white">{illogicalPromo?.currentPrice ?? "6 999"} DT</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-white/60">
                Prix avant promo : <span className="text-slate-900 line-through dark:text-white">{illogicalPromo?.regularPrice ?? "14 020"} DT</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-white/60">
                Vrai prix marché : <span className="font-semibold text-emerald-600 dark:text-emerald-400">{illogicalPromo?.marketMin ?? "6 999"} DT</span>
                <span className="ml-1 text-[10px] text-slate-400">chez Jumbo</span>
              </div>
            </div>

            {/* Remise effective */}
            <div className="mt-8 text-sm font-bold leading-snug text-red-600 dark:text-red-500">
              Remise réelle :{" "}
              {illogicalPromo
                ? illogicalPromo.currentPriceRaw <= illogicalPromo.marketMinRaw
                  ? `−${illogicalPromo.realDiscount} DT`
                  : `+${Math.round(illogicalPromo.currentPriceRaw - illogicalPromo.marketMinRaw).toLocaleString("fr-FR").replace(/ /g, " ")} DT plus cher que le marché`
                : "+7 021 DT plus cher que le marché"}
            </div>
          </div>

          {/* ILLOGIQUE! button */}
          <div className="relative mt-auto px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
            <Link
              href={illogicalPromo?.href ?? "/retail/tv-hisense-l5g-series-100-quot-uhd-4k-smart-laser-tv-android-wifi"}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-b from-red-600 to-red-700 border border-red-500 py-3.5 shadow-[0_0_24px_-4px_rgba(239,68,68,0.4)] hover:shadow-[0_0_32px_-4px_rgba(239,68,68,0.6)] transition dark:from-red-900/80 dark:to-red-950/90 dark:border-red-700/50"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-600 shadow-md dark:from-orange-400 dark:to-red-600">
                <ShieldAlert className="h-4 w-4 text-white" />
              </span>
              <span className="text-base font-black tracking-widest text-white dark:text-red-400">ILLOGIQUE !</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
