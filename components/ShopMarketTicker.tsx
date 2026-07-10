"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Store, TrendingDown } from "lucide-react";
import { ShopLogo } from "@/components/shop/ShopLogo";
import { ShopCatalogStatsPanel } from "@/components/ShopCatalogStatsPanel";
import { shopDisplayName } from "@/lib/priceRankings";
import {
  displayPrice,
  fmtTickerPrice,
  type RetailShopAvgPrices,
  type ShopAvgPriceRow,
} from "@/lib/shopAvgPriceUtils";

function ShopCard({ shop, onOpen }: { shop: ShopAvgPriceRow; onOpen: (key: string) => void }) {
  const price = displayPrice(shop);
  const name = shopDisplayName(shop.shop_key);

  return (
    <button
      type="button"
      onClick={() => onOpen(shop.shop_key)}
      className="group relative flex w-[min(88vw,14.5rem)] shrink-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-bg-border bg-bg-card text-left font-mono shadow-sm transition hover:border-brand-gold/35 hover:shadow-md hover:shadow-brand-gold/[0.06] sm:w-[14.5rem]"
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
      <div className="absolute inset-y-0 left-0 w-0.5 bg-brand-gold/60" aria-hidden />

      <div className="relative flex items-center gap-2 border-b border-bg-border bg-slate-50/90 px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.03]">
        <ShopLogo shopKey={shop.shop_key} size={32} className="shrink-0 ring-1 ring-black/5 dark:ring-white/10" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold leading-tight text-slate-900 dark:text-white" title={name}>
            {name}
          </p>
          <p className="truncate text-[9px] text-slate-500 dark:text-white/45">
            {shop.product_count.toLocaleString("fr-FR")} en stock
          </p>
        </div>
        {shop.volume_tier && (
          <span className="shrink-0 rounded border border-slate-200/80 bg-white px-1.5 py-0.5 text-[8px] font-bold text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/50">
            {shop.volume_tier}
          </span>
        )}
      </div>

      <div className="relative flex flex-1 flex-col gap-2 px-3 py-2.5">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-white/35">
            Prix moy.
          </p>
          <p className="text-xl font-black leading-none tabular-nums text-slate-900 dark:text-white">
            {fmtTickerPrice(price)}
            <span className="ml-0.5 text-[10px] font-bold text-slate-400 dark:text-white/35">DT</span>
          </p>
        </div>

        <div className="rounded-md border border-bg-border bg-slate-50/80 px-2 py-1.5 text-[9px] dark:border-white/[0.06] dark:bg-white/[0.02]">
          <p className="text-[7px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/30">
            Catalogue en stock
          </p>
          <p className="font-black tabular-nums text-slate-800 dark:text-white/90">
            {shop.product_count.toLocaleString("fr-FR")} produits
          </p>
        </div>
      </div>
    </button>
  );
}

export function ShopMarketTicker({ initial }: { initial?: RetailShopAvgPrices }) {
  const [data, setData] = useState<RetailShopAvgPrices | null>(initial ?? null);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const isPaused = useRef(false);

  const openShopPanel = (shopKey: string) => {
    isPaused.current = true;
    setSelectedShop(shopKey);
    setPanelOpen(true);
  };

  const closeShopPanel = () => {
    setPanelOpen(false);
    setTimeout(() => {
      isPaused.current = false;
    }, 400);
  };

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

  const featuredMinProducts = data?.featured_min_products ?? 1000;
  const featuredAccessible = useMemo(
    () =>
      [...(data?.shops ?? [])]
        .filter((s) => s.product_count >= featuredMinProducts)
        .sort((a, b) => a.avg_price - b.avg_price)
        .slice(0, 3),
    [data, featuredMinProducts],
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

  const renderCards = (keySuffix: string, ariaHidden = false) =>
    shops.map((s) => (
      <div key={`${s.shop_key}${keySuffix}`} className="shrink-0" aria-hidden={ariaHidden || undefined}>
        <ShopCard shop={s} onOpen={openShopPanel} />
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
            Prix moyen du catalogue par enseigne, calculé uniquement sur les produits{" "}
            <span className="font-semibold text-slate-700 dark:text-white/75">en stock</span>{" "}
            (somme des prix ÷ nombre de références disponibles) —{" "}
            <span className="font-bold text-slate-800 dark:text-white">
              {data.shop_count} enseignes
            </span>
            ,{" "}
            <span className="font-bold text-slate-800 dark:text-white">
              {data.total_products.toLocaleString("fr-FR")} références en stock
            </span>
            .
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-3 sm:flex">
            <div className="rounded-xl border border-bg-border bg-bg-card px-4 py-2.5 text-center dark:border-white/[0.08]">
              <Store className="mx-auto h-3.5 w-3.5 text-brand-gold" />
              <div className="mt-0.5 text-sm font-black tabular-nums text-slate-900 dark:text-white">
                {data.shop_count}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-white/40">Enseignes</div>
            </div>
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

      <ShopCatalogStatsPanel shopKey={selectedShop} open={panelOpen} onClose={closeShopPanel} />
    </section>
  );
}
