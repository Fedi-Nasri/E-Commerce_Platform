"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PriceRankingCard } from "@/components/PriceRankingCard";
import { PRICE_RANKING_CATALOG } from "@/lib/priceRankings";

type ScopePayload = {
  scope_id: string;
  scope_name: string;
  matched_products: number;
  distinct_shops: number;
  shops: Array<{
    rank: number;
    shop_key: string;
    fair_win_rate: number;
    products_compared: number;
  }>;
};

const SKELETON = (
  <div className="animate-pulse overflow-hidden rounded-2xl border border-bg-border bg-bg-card">
    <div className="aspect-[16/10] bg-slate-100 dark:bg-white/[0.04]" />
    <div className="space-y-2 p-4">
      <div className="h-3 w-24 rounded bg-slate-100 dark:bg-white/[0.04]" />
      <div className="h-12 rounded-xl bg-slate-100 dark:bg-white/[0.04]" />
      <div className="h-12 rounded-xl bg-slate-100 dark:bg-white/[0.04]" />
      <div className="h-12 rounded-xl bg-slate-100 dark:bg-white/[0.04]" />
    </div>
    <div className="border-t border-bg-border p-4 dark:border-white/[0.06]">
      <div className="h-10 rounded-xl bg-slate-100 dark:bg-white/[0.04]" />
    </div>
  </div>
);

export function TechOffers() {
  const [scopes, setScopes] = useState<ScopePayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  const rowRef = useRef<HTMLDivElement>(null);
  const isPaused = useRef(false);
  const autoRef = useRef<number | null>(null);

  useEffect(() => {
    fetch("/api/stats/price-rankings?featured=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.scopes)) setScopes(d.scopes);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateArrows = () => {
    // With the seamless duplicate loop, the row is effectively infinite in both
    // directions — arrows never disable.
    setCanLeft(true);
    setCanRight(true);
  };

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    updateArrows();
    return () => el.removeEventListener("scroll", updateArrows);
  }, [loading]);

  // Seamless auto-scroll: the cards row is rendered twice back-to-back.
  // When scrollLeft passes the width of the first set, we subtract that width
  // instantly — the user sees the duplicate cards seamlessly continue.
  useEffect(() => {
    if (loading) return;
    const el = rowRef.current;
    if (!el || el.scrollWidth <= el.clientWidth + 2) return;

    const SPEED = 0.5;
    let pos = el.scrollLeft;
    const step = () => {
      if (!isPaused.current && el) {
        pos += SPEED;
        // scrollWidth = width of both sets. Half of that = width of the first
        // (original) set. When we cross that boundary, teleport back by that
        // same amount so the duplicate takes over invisibly.
        const halfWidth = el.scrollWidth / 2;
        if (pos >= halfWidth) pos -= halfWidth;
        el.scrollLeft = pos;
        updateArrows();
      } else if (el) {
        pos = el.scrollLeft;
      }
      autoRef.current = requestAnimationFrame(step);
    };
    autoRef.current = requestAnimationFrame(step);

    const pause = () => { isPaused.current = true; };
    const resume = () => { isPaused.current = false; };
    el.addEventListener("mouseenter", pause);
    el.addEventListener("mouseleave", resume);
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("touchend", resume);

    return () => {
      if (autoRef.current) cancelAnimationFrame(autoRef.current);
      el.removeEventListener("mouseenter", pause);
      el.removeEventListener("mouseleave", resume);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("touchend", resume);
    };
  }, [loading]);

  const scroll = (dir: "left" | "right") => {
    const el = rowRef.current;
    if (!el) return;
    isPaused.current = true;
    const halfWidth = el.scrollWidth / 2;
    // If scrolling left near the start, jump forward to the equivalent position
    // in the duplicate set first so we can smoothly scroll left without hitting 0.
    if (dir === "left" && el.scrollLeft < 360) {
      el.scrollLeft += halfWidth;
    }
    el.scrollBy({ left: dir === "left" ? -360 : 360, behavior: "smooth" });
    setTimeout(() => { isPaused.current = false; }, 1200);
  };

  const catalogOrder = PRICE_RANKING_CATALOG.map((c) => c.scopeId);
  const cards = catalogOrder
    .map((scopeId) => {
      const catalog = PRICE_RANKING_CATALOG.find((c) => c.scopeId === scopeId)!;
      const scope = scopes.find((s) => s.scope_id === scopeId);
      if (!scope) return null;
      return { catalog, scope };
    })
    .filter(Boolean) as Array<{ catalog: (typeof PRICE_RANKING_CATALOG)[0]; scope: ScopePayload }>;

  const totalProducts = scopes.reduce((a, s) => a + (s.matched_products ?? 0), 0);

  const scrollRowClass =
    "-mx-3 flex gap-4 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0";
  const cardWrapClass = "w-[min(88vw,20rem)] shrink-0 snap-start sm:w-[19rem] lg:w-[21rem]";

  return (
    <section className="mx-auto mt-8 max-w-[1600px] px-3 sm:px-4">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="section-title">MEILLEURS PRIX PAR CATÉGORIE</h2>
          <p className="mt-2 max-w-xl text-sm text-slate-500 dark:text-white/50">
            Classement des enseignes par comparaison produit à produit
            {totalProducts > 0 && (
              <> — <span className="font-medium text-slate-700 dark:text-white/70">{totalProducts.toLocaleString("fr-FR")} références</span> analysées</>
            )}
          </p>
        </div>
        {/* Arrow buttons — hidden on mobile */}
        <div className="hidden items-center gap-2 sm:flex">
          <button
            onClick={() => scroll("left")}
            disabled={!canLeft}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-brand-gold/50 hover:text-brand-gold disabled:opacity-30 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            disabled={!canRight}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-brand-gold/50 hover:text-brand-gold disabled:opacity-30 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className={scrollRowClass}>
          {PRICE_RANKING_CATALOG.map((c) => (
            <div key={c.slug} className={cardWrapClass}>
              {SKELETON}
            </div>
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500 dark:border-white/[0.08] dark:bg-bg-800 dark:text-white/45">
          Classements en cours de chargement. Vérifiez que les données sont importées dans la base retail.
        </div>
      ) : (
        <div ref={rowRef} className={scrollRowClass}>
          {cards.map(({ catalog, scope }) => (
            <div key={catalog.slug} className={cardWrapClass}>
              <PriceRankingCard
                catalog={catalog}
                scopeName={scope.scope_name}
                matchedProducts={scope.matched_products}
                shopCount={scope.distinct_shops}
                shops={scope.shops}
              />
            </div>
          ))}
          {/* Duplicate set for seamless infinite scroll — hidden from a11y */}
          {cards.map(({ catalog, scope }) => (
            <div key={`${catalog.slug}-dup`} className={cardWrapClass} aria-hidden="true">
              <PriceRankingCard
                catalog={catalog}
                scopeName={scope.scope_name}
                matchedProducts={scope.matched_products}
                shopCount={scope.distinct_shops}
                shops={scope.shops}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
