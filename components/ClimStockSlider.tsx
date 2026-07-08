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

// Sky/ice palette — deliberately distinct from the gold TechOffers section.
const RANK_ACCENT = [
  {
    ring: "ring-sky-400/60",
    badge: "bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-[0_2px_10px_rgba(56,132,255,0.45)]",
    price: "text-sky-600 dark:text-sky-300",
    glow: "before:bg-sky-400/10",
  },
  {
    ring: "ring-slate-300/60",
    badge: "bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-sm",
    price: "text-slate-700 dark:text-white/80",
    glow: "before:bg-slate-300/10",
  },
  {
    ring: "ring-cyan-400/50",
    badge: "bg-gradient-to-br from-cyan-400 to-teal-500 text-white shadow-sm",
    price: "text-cyan-700 dark:text-cyan-300",
    glow: "before:bg-cyan-400/10",
  },
];

function BrandTile({ b }: { b: ClimSliderBrand }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 dark:ring-white/10">
        {b.logo && !broken ? (
          <img
            src={b.logo}
            alt=""
            className="h-7 w-7 object-contain"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="text-[11px] font-black text-slate-500">{b.label.slice(0, 2).toUpperCase()}</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-bold text-slate-800 dark:text-white/85">{b.label}</div>
        <div className="text-[10px] tabular-nums text-slate-400 dark:text-white/40">{b.count} modèles</div>
      </div>
    </div>
  );
}

export function ClimStockSlider({ data }: { data: ClimSliderData }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const isPaused = useRef(false);
  const autoRef = useRef<number | null>(null);

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

  const scroll = (dir: "left" | "right") => {
    const el = rowRef.current;
    if (!el) return;
    isPaused.current = true;
    const halfWidth = el.scrollWidth / 2;
    if (dir === "left" && el.scrollLeft < 360) el.scrollLeft += halfWidth;
    el.scrollBy({ left: dir === "left" ? -360 : 360, behavior: "smooth" });
    setTimeout(() => { isPaused.current = false; }, 1200);
  };

  const cardWrap = "w-[min(88vw,21rem)] shrink-0 sm:w-[20rem] lg:w-[22rem]";

  const cards = (
    <>
      {/* BTU tier cards — sky-tinted, bigger logos, ranked by cheapest */}
      {data.btuCards.map((card) => (
        <div key={card.btu} className={cardWrap}>
          <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-sky-500/15 bg-gradient-to-b from-sky-50/60 to-bg-card shadow-sm transition hover:border-sky-400/40 hover:shadow-lg dark:from-sky-950/25 dark:to-bg-card dark:shadow-none">
            {/* header band */}
            <div className="relative overflow-hidden border-b border-sky-500/10 bg-gradient-to-r from-sky-500/10 via-blue-500/5 to-transparent px-5 py-4 dark:border-white/[0.06]">
              <Snowflake className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 text-sky-400/15" strokeWidth={1.5} />
              <div className="relative flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-300">
                  <Wind className="h-4 w-4" strokeWidth={2} />
                </span>
                <div>
                  <h3 className="text-xl font-black leading-none tracking-tight text-slate-900 dark:text-white">
                    {fmt(Number(card.btu))} <span className="text-sm font-bold text-sky-600 dark:text-sky-300">BTU</span>
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-white/50">
                    {card.totalOffers} offres en stock
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-2.5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-white/40">
                Moins chers
              </p>
              <ul className="flex flex-col gap-2.5">
                {card.rows.map((row, i) => {
                  const a = RANK_ACCENT[i] ?? RANK_ACCENT[2];
                  return (
                    <li
                      key={row.shop}
                      className={`relative flex items-center gap-3 overflow-hidden rounded-2xl bg-white/70 p-2.5 ring-1 ${a.ring} transition hover:bg-white dark:bg-white/[0.04] dark:hover:bg-white/[0.07] before:pointer-events-none before:absolute before:-right-6 before:-top-6 before:h-16 before:w-16 before:rounded-full before:blur-xl ${a.glow}`}
                    >
                      {/* rank badge */}
                      <span className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black tabular-nums ${a.badge}`}>
                        {row.rank === 1 ? <Medal className="h-4 w-4" strokeWidth={2.25} /> : row.rank}
                      </span>
                      {/* bigger logo */}
                      <ShopLogo shopKey={row.shop} size={48} className="shrink-0" />
                      <div className="relative min-w-0 flex-1">
                        <p className="truncate text-[14px] font-black text-slate-900 dark:text-white">{row.shopName}</p>
                        <p className="truncate text-[10.5px] capitalize text-slate-500 dark:text-white/45">
                          {row.marqueMin} · {row.nbAnnonces} modèles
                        </p>
                      </div>
                      <div className="relative shrink-0 text-right">
                        <span className={`block text-[15px] font-black leading-none tabular-nums ${a.price}`}>
                          {fmt(row.prixMin)}
                        </span>
                        <span className="text-[9px] font-bold uppercase text-slate-400 dark:text-white/40">DT dès</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="mt-auto p-4 pt-0">
              <Link
                href="/climatiseurs-stock"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500/10 px-4 py-2.5 text-[12px] font-bold text-sky-700 ring-1 ring-sky-500/25 transition hover:bg-sky-500/20 dark:text-sky-300"
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
        <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-sky-500/15 bg-gradient-to-b from-sky-50/60 to-bg-card shadow-sm transition hover:border-sky-400/40 hover:shadow-lg dark:from-sky-950/25 dark:to-bg-card dark:shadow-none">
          <div className="border-b border-sky-500/10 bg-gradient-to-r from-sky-500/10 via-blue-500/5 to-transparent px-5 py-4 dark:border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-300">
                <Tag className="h-4 w-4" strokeWidth={2} />
              </span>
              <div>
                <h3 className="text-lg font-black leading-none tracking-tight text-slate-900 dark:text-white">
                  {data.totals.marques} marques
                </h3>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-white/50">disponibles en stock</p>
              </div>
            </div>
          </div>
          <div className="grid flex-1 grid-cols-2 content-start gap-2 p-4">
            {data.topBrands.map((b) => (
              <BrandTile key={b.brand} b={b} />
            ))}
          </div>
          <div className="mt-auto p-4 pt-0">
            <Link
              href="/climatiseurs-stock"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500/10 px-4 py-2.5 text-[12px] font-bold text-sky-700 ring-1 ring-sky-500/25 transition hover:bg-sky-500/20 dark:text-sky-300"
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
      {/* ── Animated banner ─────────────────────────────────────────────── */}
      <div className="group relative mb-6 overflow-hidden rounded-3xl border border-sky-500/25 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 shadow-[0_20px_50px_-20px_rgba(37,99,235,0.5)]">
        {/* animated frost blobs */}
        <div className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full bg-white/15 blur-3xl animate-[clim-drift_9s_ease-in-out_infinite]" />
        <div className="pointer-events-none absolute right-1/3 top-0 h-48 w-48 rounded-full bg-cyan-300/20 blur-3xl animate-[clim-drift_11s_ease-in-out_infinite_reverse]" />
        {/* floating snowflakes */}
        <Snowflake className="pointer-events-none absolute left-[12%] top-4 h-5 w-5 text-white/30 animate-[clim-float_6s_ease-in-out_infinite]" />
        <Snowflake className="pointer-events-none absolute left-[38%] bottom-3 h-4 w-4 text-white/20 animate-[clim-float_7s_ease-in-out_infinite_1s]" />
        <Snowflake className="pointer-events-none absolute right-[42%] top-6 h-6 w-6 text-white/25 animate-[clim-float_8s_ease-in-out_infinite_0.5s]" />

        <div className="relative flex flex-col items-center gap-5 p-6 sm:flex-row sm:justify-between sm:p-8">
          <div className="max-w-xl text-center sm:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
              <Snowflake className="h-3 w-3" /> Été 2026 · Mise à jour temps réel
            </span>
            <h2 className="mt-3 text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl md:text-4xl">
              Climatiseurs <span className="text-cyan-200">en stock</span> en Tunisie
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/85">
              <span className="font-black text-white">{fmt(data.totals.climatiseurs)}</span> climatiseurs disponibles chez{" "}
              <span className="font-black text-white">{data.totals.boutiques}</span> enseignes ·{" "}
              <span className="font-black text-white">{data.totals.marques}</span> marques comparées par prix et capacité.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              {data.cheapest && (
                <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-100">Prix d'entrée</p>
                  <p className="text-lg font-black tabular-nums text-white">
                    {fmt(data.cheapest.price)} DT
                    {data.cheapest.btu && <span className="ml-1 text-[11px] font-medium text-white/70">· {fmt(Number(data.cheapest.btu))} BTU</span>}
                  </p>
                </div>
              )}
              <Link
                href="/climatiseurs-stock"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-black text-blue-700 shadow-lg transition hover:scale-[1.03] hover:bg-cyan-50"
              >
                Voir toutes les stats
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* category image, floating */}
          <div className="relative shrink-0">
            <div className="absolute inset-0 -z-10 rounded-full bg-white/20 blur-2xl" />
            <img
              src="/climatiseur-category.png"
              alt="Climatiseurs"
              className="h-32 w-auto object-contain drop-shadow-2xl transition duration-500 animate-[clim-float_5s_ease-in-out_infinite] group-hover:scale-105 sm:h-40 md:h-48"
              loading="eager"
            />
          </div>
        </div>
      </div>

      {/* ── Header row for the slider ───────────────────────────────────── */}
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="flex items-center gap-2 text-slate-500 dark:text-white/50">
          <Store className="h-4 w-4 text-sky-500" />
          <p className="text-sm font-medium">Classement des enseignes par capacité et par prix</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll("left")}
            aria-label="Précédent"
            className="hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-sky-400/50 hover:text-sky-500 sm:flex dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            aria-label="Suivant"
            className="hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-sky-400/50 hover:text-sky-500 sm:flex dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={rowRef}
        className="-mx-3 flex gap-4 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
      >
        {cards}
        {/* Duplicate set for seamless infinite scroll */}
        <div className="contents" aria-hidden="true">{cards}</div>
      </div>

      <style jsx>{`
        @keyframes clim-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes clim-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, 12px) scale(1.1); }
        }
      `}</style>
    </section>
  );
}
