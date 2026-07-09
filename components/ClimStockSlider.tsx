"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Medal, Snowflake, Store, Tag, Wind } from "lucide-react";
import { ShopLogo } from "@/components/shop/ShopLogo";

export type ClimSliderBtuCard = {
  btu: string;
  totalOffers: number;
  rows: {
    rank: number;
    shop: string;
    shopName: string;
    prixMin: number;
    prixMoyen: number;
    nbAnnonces: number;
    marqueMin: string;
  }[];
};

export type ClimSliderBrand = {
  brand: string;
  label: string;
  count: number;
  logo: string | null;
};

export type ClimSliderData = {
  totals: { climatiseurs: number; boutiques: number; marques: number };
  generatedAt: string;
  cheapest: { price: number; shopName: string; btu: string | null } | null;
  btuCards: ClimSliderBtuCard[];
  topBrands: ClimSliderBrand[];
};

const fmt = (n: number) => n.toLocaleString("fr-FR");

const MEDAL_ROW = [
  "border-brand-gold/35 bg-gradient-to-r from-amber-50 via-brand-gold/12 to-amber-50/35 shadow-[0_8px_22px_-18px_rgba(245,166,35,0.9)] dark:border-brand-gold/35 dark:from-brand-gold/16 dark:via-brand-gold/8 dark:to-transparent",
  "border-slate-300/80 bg-gradient-to-r from-slate-100 via-white to-slate-50 dark:border-white/15 dark:from-white/[0.11] dark:via-white/[0.06] dark:to-transparent",
  "border-amber-700/30 bg-gradient-to-r from-orange-50/85 via-amber-50/45 to-orange-50/20 dark:border-amber-700/30 dark:from-amber-950/60 dark:via-amber-900/24 dark:to-transparent",
];
const MEDAL_BADGE = [
  "bg-gradient-to-br from-[#f6d365] via-brand-gold to-[#d4a23a] text-slate-900 shadow-[0_2px_10px_rgba(246,196,83,0.45)] ring-1 ring-brand-gold/40",
  "bg-gradient-to-br from-[#e8e8e8] via-[#c0c0c0] to-[#9ca3af] text-slate-800 shadow-sm ring-1 ring-white/50 dark:from-[#d1d5db] dark:via-[#9ca3af] dark:to-[#6b7280] dark:text-slate-950 dark:ring-white/20",
  "bg-gradient-to-br from-[#e8a86b] via-[#cd7f32] to-[#9a5c22] text-white shadow-sm ring-1 ring-amber-900/20",
];

function BrandTile({ b }: { b: ClimSliderBrand }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2 dark:border-white/[0.06] dark:bg-white/[0.03]">
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200/80 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300/90 shadow-sm dark:border-slate-200/25 dark:from-slate-600 dark:via-slate-500 dark:to-slate-700">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[1.5px] rounded-[7px] ring-1 ring-black/[0.12] dark:ring-white/[0.14]"
        />
        {b.logo && !broken ? (
          <img
            src={b.logo}
            alt=""
            className="relative z-[1] h-6 w-6 object-contain contrast-[1.22] saturate-[1.14] drop-shadow-[0_1px_2px_rgba(15,23,42,0.55)]"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="relative z-[1] text-[10px] font-black text-slate-600 dark:text-slate-100">{b.label.slice(0, 2).toUpperCase()}</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-bold text-slate-800 dark:text-white/85">{b.label}</div>
        <div className="text-[9.5px] tabular-nums text-slate-400 dark:text-white/40">{b.count} modèles</div>
      </div>
    </div>
  );
}

export function ClimStockSlider({ data }: { data: ClimSliderData }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const isPaused = useRef(false);
  const autoRef = useRef<number | null>(null);
  const [activeRank, setActiveRank] = useState(0);

  // Seamless duplicate-loop auto-scroll (cards rendered twice back-to-back).
  useEffect(() => {
    const el = rowRef.current;
    if (!el || el.scrollWidth <= el.clientWidth + 2) return;

    const SPEED = 0.5;
    let pos = el.scrollLeft;
    const step = () => {
      if (!isPaused.current && el) {
        pos += SPEED;
        const halfWidth = el.scrollWidth / 2;
        if (pos >= halfWidth) pos -= halfWidth;
        el.scrollLeft = pos;
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
  }, []);

  // Subtle rank spotlight: 1 -> 2 -> 3 in a loop.
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveRank((prev) => (prev + 1) % 3);
    }, 1100);
    return () => clearInterval(timer);
  }, []);

  const scroll = (dir: "left" | "right") => {
    const el = rowRef.current;
    if (!el) return;
    isPaused.current = true;
    const halfWidth = el.scrollWidth / 2;
    if (dir === "left" && el.scrollLeft < 360) el.scrollLeft += halfWidth;
    el.scrollBy({ left: dir === "left" ? -360 : 360, behavior: "smooth" });
    setTimeout(() => { isPaused.current = false; }, 1200);
  };

  const cardWrap = "w-[min(88vw,20rem)] shrink-0 sm:w-[19rem] lg:w-[21rem]";

  const cards = (
    <>
      {/* Lead card — hero + totals */}
      <div className={cardWrap}>
        <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-sky-500/25 bg-bg-card shadow-sm transition hover:border-sky-400/50 hover:shadow-md dark:shadow-none">
          <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-sky-100 via-blue-50 to-white p-5 dark:from-sky-950/60 dark:via-[#0d1526] dark:to-bg-900">
            <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-sky-400/15 blur-2xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">
                  <Snowflake className="h-3 w-3" /> Été 2026 · En stock
                </p>
                <h3 className="mt-1.5 text-xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">
                  {fmt(data.totals.climatiseurs)} climatiseurs
                </h3>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-white/55">
                  disponibles chez {data.totals.boutiques} enseignes · {data.totals.marques} marques
                </p>
              </div>
              <img src="/clim.png" alt="" className="h-16 w-16 shrink-0 object-contain drop-shadow-md transition duration-500 group-hover:scale-110" loading="lazy" />
            </div>
          </div>
          <div className="flex flex-1 flex-col justify-center gap-2 p-4">
            {data.cheapest && (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Prix d'entrée{data.cheapest.btu ? ` · ${fmt(Number(data.cheapest.btu))} BTU` : ""}
                </p>
                <p className="mt-0.5 text-2xl font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                  {fmt(data.cheapest.price)} <span className="text-sm font-bold">DT</span>
                </p>
                <p className="text-[11px] text-slate-500 dark:text-white/50">chez {data.cheapest.shopName}</p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Wind, v: String(data.btuCards.length), l: "capacités" },
                { icon: Store, v: String(data.totals.boutiques), l: "enseignes" },
                { icon: Tag, v: String(data.totals.marques), l: "marques" },
              ].map((c) => (
                <div key={c.l} className="rounded-lg bg-slate-50 px-2 py-2 text-center dark:bg-white/[0.04]">
                  <c.icon className="mx-auto h-3.5 w-3.5 text-sky-500" />
                  <div className="mt-0.5 text-sm font-black tabular-nums text-slate-900 dark:text-white">{c.v}</div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-white/40">{c.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-auto border-t border-bg-border p-4 dark:border-white/[0.06]">
            <Link
              href="/climatiseurs-stock"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500/10 px-4 py-2.5 text-[12px] font-semibold text-sky-700 ring-1 ring-sky-500/30 transition hover:bg-sky-500/20 dark:text-sky-300"
            >
              Voir toutes les stats
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </article>
      </div>

      {/* One card per BTU tier */}
      {data.btuCards.map((card) => (
        <div key={card.btu} className={cardWrap}>
          <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-bg-border bg-bg-card shadow-sm transition hover:border-brand-gold/30 hover:shadow-md dark:shadow-none dark:hover:border-brand-gold/25">
            <div className="border-b border-bg-border p-4 dark:border-white/[0.06]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-white/45">
                Climatiseurs · en stock
              </p>
              <h3 className="mt-1 text-lg font-black leading-tight tracking-tight text-slate-900 dark:text-white">
                {fmt(Number(card.btu))} BTU
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-white/50">
                {card.totalOffers} offres comparées
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/40">
                Top 3 moins chers
              </p>
              <ul className="flex flex-col gap-2.5">
                {card.rows.map((row, i) => (
                  <li
                    key={row.shop}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-500 ease-out will-change-transform ${
                      i === activeRank
                        ? "z-[2] scale-[1.075] -translate-y-0.5 shadow-[0_18px_34px_-18px_rgba(15,23,42,0.88)] ring-2 ring-brand-gold/35 brightness-[1.06]"
                        : "scale-[0.985] opacity-[0.86]"
                    } ${MEDAL_ROW[i] ?? MEDAL_ROW[2]}`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black tabular-nums ${MEDAL_BADGE[i] ?? MEDAL_BADGE[2]}`}
                    >
                      {row.rank === 1 ? <Medal className="h-4 w-4" strokeWidth={2.25} /> : row.rank}
                    </span>
                    <ShopLogo shopKey={row.shop} size={38} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                        {row.shopName}
                      </p>
                      <p className="truncate text-[10px] font-medium capitalize text-slate-500 dark:text-white/50">
                        {row.marqueMin} · {row.nbAnnonces} modèles
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-white/70 px-2.5 py-1 text-sm font-black tabular-nums text-slate-900 ring-1 ring-black/5 dark:bg-white/[0.08] dark:text-brand-gold dark:ring-white/10">
                      {fmt(row.prixMin)} <span className="text-[10px] font-bold opacity-80">DT</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-auto border-t border-bg-border p-4 dark:border-white/[0.06]">
              <Link
                href="/climatiseurs-stock"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-bg-border bg-slate-50 px-4 py-2.5 text-[12px] font-semibold text-slate-800 transition hover:border-brand-gold/40 hover:bg-white hover:text-brand-gold dark:border-white/10 dark:bg-white/[0.03] dark:text-white/85 dark:hover:border-brand-gold/30 dark:hover:bg-white/[0.06]"
              >
                Comparatif complet
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </Link>
            </div>
          </article>
        </div>
      ))}

      {/* Brands card */}
      <div className={cardWrap}>
        <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-bg-border bg-bg-card shadow-sm transition hover:border-brand-gold/30 hover:shadow-md dark:shadow-none dark:hover:border-brand-gold/25">
          <div className="border-b border-bg-border p-4 dark:border-white/[0.06]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-white/45">
              Climatiseurs · en stock
            </p>
            <h3 className="mt-1 text-lg font-black leading-tight tracking-tight text-slate-900 dark:text-white">
              {data.totals.marques} marques disponibles
            </h3>
          </div>
          <div className="grid flex-1 grid-cols-2 content-start gap-2 p-4">
            {data.topBrands.map((b) => (
              <BrandTile key={b.brand} b={b} />
            ))}
          </div>
          <div className="mt-auto border-t border-bg-border p-4 dark:border-white/[0.06]">
            <Link
              href="/climatiseurs-stock"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-bg-border bg-slate-50 px-4 py-2.5 text-[12px] font-semibold text-slate-800 transition hover:border-brand-gold/40 hover:bg-white hover:text-brand-gold dark:border-white/10 dark:bg-white/[0.03] dark:text-white/85 dark:hover:border-brand-gold/30 dark:hover:bg-white/[0.06]"
            >
              Toutes les marques
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </article>
      </div>
    </>
  );

  return (
    <section className="mx-auto mt-8 max-w-[1600px] px-3 sm:px-4">
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">
              Comparatif temps réel
            </p>
            <h2 className="mt-1 text-[1.65rem] font-black leading-[1.05] tracking-tight text-slate-900 sm:text-[1.8rem] dark:text-white">
              Climatiseurs en stock
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-500 sm:text-[13.5px] dark:text-white/55">
              Disponibilité et meilleurs prix en temps réel —{" "}
              <span className="font-extrabold text-slate-800 dark:text-white">
                {fmt(data.totals.climatiseurs)} climatiseurs
              </span>{" "}
              chez{" "}
              <span className="font-bold text-slate-700 dark:text-white/80">
                {data.totals.boutiques} enseignes
              </span>
              .
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/climatiseurs-stock"
              className="hidden items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2 text-xs font-bold text-sky-700 transition hover:bg-sky-500/20 sm:flex dark:text-sky-300"
            >
              Voir plus <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              onClick={() => scroll("left")}
              aria-label="Précédent"
              className="hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-brand-gold/50 hover:text-brand-gold sm:flex dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              aria-label="Suivant"
              className="hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-brand-gold/50 hover:text-brand-gold sm:flex dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <Link
          href="/climatiseurs-stock"
          className="group relative block overflow-hidden rounded-2xl border border-orange-500/30 shadow-card transition hover:border-orange-400/60 hover:shadow-[0_0_32px_-8px_rgba(249,115,22,0.5)]"
        >
          <div className="relative w-full" style={{ aspectRatio: "1566 / 232" }}>
            <img
              src="/climatiseur-category.png"
              alt="Climatiseurs · Meilleures offres"
              className="block h-full w-full object-cover transition-transform duration-[6000ms] ease-out scale-105 group-hover:scale-110"
              loading="lazy"
            />
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/15 via-transparent to-black/25" />
          </div>
        </Link>
      </div>

      <div
        ref={rowRef}
        className="-mx-3 flex gap-4 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
      >
        {cards}
        {/* Duplicate set for seamless infinite scroll */}
        <div className="contents" aria-hidden="true">{cards}</div>
      </div>
    </section>
  );
}
