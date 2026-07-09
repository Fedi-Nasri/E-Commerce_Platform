"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BarChart3, ChevronLeft, ChevronRight, Store, TrendingDown, TrendingUp } from "lucide-react";
import { ShopLogo } from "@/components/shop/ShopLogo";
import { shopDisplayName } from "@/lib/priceRankings";
import {
  displayPrice,
  fmtTickerPrice,
  type RetailShopAvgPrices,
  type ShopAvgPriceRow,
} from "@/lib/retailShopAvgPrices";

function fmtPct(p: number) {
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(1)}%`;
}

function MiniSpark({ shop, up }: { shop: ShopAvgPriceRow; up: boolean }) {
  const seed = shop.shop_key.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const pts = Array.from({ length: 10 }, (_, i) => {
    const wobble = Math.sin(seed * 0.17 + i * 0.9) * 5;
    const trend = up ? i * 1.1 : -i * 1;
    return 20 + trend + wobble;
  });
  const d = pts.map((y, i) => `${i === 0 ? "M" : "L"}${i * 11} ${y}`).join(" ");

  return (
    <svg viewBox="0 0 99 40" className="h-8 w-[4.25rem] shrink-0 opacity-90" aria-hidden>
      <path
        d={d}
        fill="none"
        stroke={up ? "#ef4444" : "#10b981"}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShopCard({ shop }: { shop: ShopAvgPriceRow }) {
  const up = shop.vs_market_pct >= 0;
  const price = displayPrice(shop);
  const name = shopDisplayName(shop.shop_key);

  return (
    <Link
      href={`/boutiques/${shop.shop_key}`}
      className={`group relative flex w-[min(88vw,14.5rem)] shrink-0 flex-col overflow-hidden rounded-xl border font-mono shadow-sm transition sm:w-[14.5rem] ${
        up
          ? "border-bg-border bg-bg-card hover:border-red-400/30 hover:shadow-md hover:shadow-red-500/[0.06] dark:hover:border-red-400/25"
          : "border-bg-border bg-bg-card hover:border-emerald-400/30 hover:shadow-md hover:shadow-emerald-500/[0.06] dark:hover:border-emerald-400/25"
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.055]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(100,116,139,0.45) 1px, transparent 1px), linear-gradient(90deg, rgba(100,116,139,0.45) 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
        aria-hidden
      />
      <div
        className={`absolute inset-y-0 left-0 w-0.5 ${up ? "bg-red-500" : "bg-emerald-500"}`}
        aria-hidden
      />

      <div className="relative flex items-center gap-2 border-b border-bg-border bg-slate-50/90 px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.03]">
        <ShopLogo shopKey={shop.shop_key} size={32} className="shrink-0 ring-1 ring-black/5 dark:ring-white/10" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold leading-tight text-slate-900 dark:text-white" title={name}>
            {name}
          </p>
          <p className="truncate text-[9px] text-slate-500 dark:text-white/45">
            {shop.product_count.toLocaleString("fr-FR")} produits
          </p>
        </div>
        {shop.volume_tier && (
          <span className="shrink-0 rounded border border-slate-200/80 bg-white px-1.5 py-0.5 text-[8px] font-bold text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/50">
            {shop.volume_tier}
          </span>
        )}
      </div>

      <div className="relative flex flex-1 flex-col gap-2 px-3 py-2.5">
        <div className="flex items-end justify-between gap-1">
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-white/35">
              Last
            </p>
            <p
              className={`text-xl font-black leading-none tabular-nums ${
                up ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {fmtTickerPrice(price)}
              <span className="ml-0.5 text-[10px] font-bold text-slate-400 dark:text-white/35">DT</span>
            </p>
          </div>
          <MiniSpark shop={shop} up={up} />
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-bg-border bg-bg-border text-[9px] dark:border-white/[0.06] dark:bg-white/[0.06]">
          <div className="bg-slate-50/80 px-2 py-1.5 dark:bg-white/[0.02]">
            <p className="text-[7px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">Vol.</p>
            <p className="font-black tabular-nums text-slate-800 dark:text-white/90">
              {shop.product_count.toLocaleString("fr-FR")}
            </p>
          </div>
          <div className="bg-slate-50/80 px-2 py-1.5 text-right dark:bg-white/[0.02]">
            <p className="text-[7px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">Chg.</p>
            <p
              className={`inline-flex items-center justify-end gap-0.5 font-black tabular-nums ${
                up ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {fmtPct(shop.vs_market_pct)}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function ShopMarketTicker({ initial }: { initial?: RetailShopAvgPrices }) {
  const [data, setData] = useState<RetailShopAvgPrices | null>(initial ?? null);
  const rowRef = useRef<HTMLDivElement>(null);
  const isPaused = useRef(false);

  useEffect(() => {
    if (initial) return;
    fetch("/api/stats/shop-avg-prices")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.shops && setData(d))
      .catch(() => {});
  }, [initial]);

  const shops = useMemo(
    () => [...(data?.shops ?? [])].sort((a, b) => b.product_count - a.product_count),
    [data],
  );

  useEffect(() => {
    const el = rowRef.current;
    if (!el || shops.length === 0) return;

    let pos = el.scrollLeft;
    let frame = 0;
    const SPEED = 0.55;

    const tick = () => {
      if (!isPaused.current && el.scrollWidth > el.clientWidth + 2) {
        pos += SPEED;
        const halfWidth = el.scrollWidth / 2;
        if (pos >= halfWidth) pos -= halfWidth;
        el.scrollLeft = pos;
      } else {
        pos = el.scrollLeft;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    const pause = () => { isPaused.current = true; };
    const resume = () => { isPaused.current = false; };

    el.addEventListener("mouseenter", pause);
    el.addEventListener("mouseleave", resume);
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("touchend", resume);

    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("mouseenter", pause);
      el.removeEventListener("mouseleave", resume);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("touchend", resume);
    };
  }, [shops.length]);

  const scroll = (dir: "left" | "right") => {
    const el = rowRef.current;
    if (!el) return;
    isPaused.current = true;
    const half = el.scrollWidth / 2;
    if (dir === "left" && el.scrollLeft < 360) el.scrollLeft += half;
    el.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
    setTimeout(() => { isPaused.current = false; }, 1200);
  };

  if (!data?.shops?.length) {
    return (
      <section className="mx-auto mt-8 max-w-[1600px] px-3 sm:px-4">
        <div className="animate-pulse rounded-2xl border border-bg-border bg-bg-card p-6">
          <div className="h-4 w-48 rounded bg-slate-100 dark:bg-white/[0.04]" />
          <div className="mt-4 h-28 rounded-xl bg-slate-100 dark:bg-white/[0.04]" />
        </div>
      </section>
    );
  }

  const featuredAccessible = ["spacenet", "mytek", "wiki"]
    .map((key) => data.shops.find((s) => s.shop_key === key))
    .filter(Boolean) as ShopAvgPriceRow[];

  const renderCards = (keySuffix: string, ariaHidden = false) =>
    shops.map((s) => (
      <div key={`${s.shop_key}${keySuffix}`} className="shrink-0" aria-hidden={ariaHidden || undefined}>
        <ShopCard shop={s} />
      </div>
    ));

  return (
    <section className="mx-auto mt-8 max-w-[1600px] px-3 sm:px-4">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-gold">
            Comparatif enseignes
          </p>
          <h2 className="mt-1 text-[1.65rem] font-black leading-[1.05] tracking-tight text-slate-900 sm:text-[1.8rem] dark:text-white">
            Indice prix catalogue retail
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-500 dark:text-white/55">
            Prix moyen ajusté par mix de catégories (électro, info, gaming, smartphones) —{" "}
            <span className="font-bold text-slate-800 dark:text-white">
              {fmtTickerPrice(data.market_avg_price)} DT
            </span>{" "}
            de moyenne marché sur{" "}
            <span className="font-bold text-slate-800 dark:text-white">
              {data.total_products.toLocaleString("fr-FR")} références
            </span>
            .
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-3 sm:flex">
            {[
              { icon: BarChart3, label: "Moyenne", value: `${fmtTickerPrice(data.market_avg_price)} DT` },
              { icon: Store, label: "Enseignes", value: String(data.shop_count) },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-bg-border bg-bg-card px-4 py-2.5 text-center dark:border-white/[0.08]"
              >
                <s.icon className="mx-auto h-3.5 w-3.5 text-brand-gold" />
                <div className="mt-0.5 text-sm font-black tabular-nums text-slate-900 dark:text-white">{s.value}</div>
                <div className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-white/40">{s.label}</div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label="Précédent"
            className="hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-brand-gold/50 hover:text-brand-gold sm:flex dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label="Suivant"
            className="hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-brand-gold/50 hover:text-brand-gold sm:flex dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {featuredAccessible.length > 0 && (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-[12px] text-slate-600 dark:text-white/60">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            <TrendingDown className="h-3 w-3" />
            Catalogues les plus accessibles
          </span>
          {featuredAccessible.map((s) => shopDisplayName(s.shop_key)).join(" · ")}
        </p>
      )}

      <div className="relative overflow-hidden rounded-xl border border-bg-border bg-gradient-to-b from-slate-50/90 to-bg-card dark:from-white/[0.04] dark:to-bg-card">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-gold/35 to-transparent"
          aria-hidden
        />
        <div
          ref={rowRef}
          className="flex gap-3 overflow-x-auto px-3 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {renderCards("")}
          {renderCards("-dup", true)}
        </div>
      </div>
    </section>
  );
}
