"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, RotateCw, Trophy, Zap, Package, TrendingUp, Award, Percent } from "lucide-react";

export type ShopStat = {
  shop: string;
  displayName: string;
  logo: string | null;
  rank: number;
  totalProducts: number;
  cheapestCount: number;
  avgPrice?: number;
  similarProducts?: number;
  promoCount?: number;
  promoPct?: number;
  score?: number;
  crossedProducts?: number;
  cheapestWins?: number;
  cheapestRatePct?: number;
  crossingRatePct?: number;
};

const RANK_BADGE = [
  "bg-gradient-to-br from-yellow-400 to-amber-600 text-yellow-950 shadow-[0_2px_10px_rgba(246,196,83,0.45)] ring-1 ring-brand-gold/40",
  "bg-gradient-to-br from-slate-300 to-slate-500 text-slate-900 shadow-sm ring-1 ring-slate-300/50",
  "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-sm ring-1 ring-orange-400/40",
];

function rankBadgeClass(rank: number): string {
  if (rank <= 3) return RANK_BADGE[rank - 1];
  return "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-white/70";
}

function fmtPrice(n: number): string {
  if (n >= 1000) return Math.round(n).toLocaleString("fr-FR");
  return n.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
}

function ShopLogoImg({ src, name, size = 56 }: { src: string | null; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    const initials = name
      .replace(/[_-]/g, " ")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-slate-200 font-black text-slate-600 dark:bg-white/10 dark:text-white/70"
        style={{ width: size, height: size, fontSize: size * 0.32 }}
      >
        {initials || "?"}
      </div>
    );
  }
  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-white/10"
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt={name}
        className="h-full w-full object-contain"
        onError={() => setBroken(true)}
      />
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: any;
  label: string;
  value: string;
  tone?: "default" | "gold" | "emerald" | "blue" | "red";
}) {
  const tones: Record<string, string> = {
    default: "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.04]",
    gold: "border-brand-gold/30 bg-brand-gold/10",
    emerald: "border-emerald-500/30 bg-emerald-500/10",
    blue: "border-blue-500/30 bg-blue-500/10",
    red: "border-red-500/30 bg-red-500/10",
  };
  const iconTones: Record<string, string> = {
    default: "text-slate-500 dark:text-white/50",
    gold: "text-brand-gold",
    emerald: "text-emerald-600 dark:text-emerald-400",
    blue: "text-blue-600 dark:text-blue-400",
    red: "text-red-500 dark:text-red-400",
  };
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${tones[tone]}`}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${iconTones[tone]}`} strokeWidth={2.2} />
      <div className="min-w-0 leading-tight">
        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/40">
          {label}
        </div>
        <div className="text-[13px] font-black tabular-nums text-slate-900 dark:text-white">
          {value}
        </div>
      </div>
    </div>
  );
}

export function ShopFlipCard({ shop, category }: { shop: ShopStat; category: string }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="group relative h-[280px] [perspective:1400px]"
      onClick={() => setFlipped((f) => !f)}
    >
      <div
        className={`relative h-full w-full transition-transform duration-700 [transform-style:preserve-3d] ${
          flipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        {/* ════════ FRONT ════════ */}
        <div
          className="absolute inset-0 [backface-visibility:hidden]"
        >
          <div className="flex h-full cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-bg-border bg-bg-card p-5 shadow-card transition-all duration-300 hover:border-brand-gold/40 hover:shadow-[0_8px_30px_-12px_rgba(246,196,83,0.3)] hover:-translate-y-1">
            {/* Rank badge */}
            <div className="absolute left-3 top-3">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${rankBadgeClass(shop.rank)}`}
              >
                {shop.rank === 1 ? <Trophy className="h-4 w-4" strokeWidth={2.25} /> : shop.rank}
              </span>
            </div>

            {/* Flip hint */}
            <div className="absolute right-3 top-3 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-300 transition group-hover:text-brand-gold dark:text-white/30">
              <RotateCw className="h-3 w-3" />
              Stats
            </div>

            {/* Logo */}
            <div className="mt-4">
              <ShopLogoImg src={shop.logo} name={shop.displayName} size={72} />
            </div>

            {/* Name */}
            <div className="text-center">
              <h3 className="text-base font-black leading-tight text-slate-900 dark:text-white">
                {shop.displayName}
              </h3>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-white/50">
                {shop.totalProducts.toLocaleString("fr-FR")} produits
              </p>
            </div>

            {/* Quick highlight */}
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5">
              <Zap className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[11px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {shop.cheapestCount.toLocaleString("fr-FR")} meilleurs prix
              </span>
            </div>

            {/* Category tag */}
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-bg-border bg-bg-700 px-3 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/40">
              {category}
            </span>
          </div>
        </div>

        {/* ════════ BACK ════════ */}
        <div
          className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <div className="flex h-full cursor-pointer flex-col rounded-2xl border border-brand-gold/30 bg-gradient-to-br from-bg-card to-bg-800 p-4 shadow-card">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-bg-border pb-2.5 dark:border-white/10">
              <div className="flex min-w-0 items-center gap-2">
                <ShopLogoImg src={shop.logo} name={shop.displayName} size={32} />
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black text-slate-900 dark:text-white">
                    {shop.displayName}
                  </h3>
                  <p className="text-[9px] text-slate-400 dark:text-white/40">
                    #{shop.rank} · {category}
                  </p>
                </div>
              </div>
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${rankBadgeClass(shop.rank)}`}
              >
                {shop.rank}
              </span>
            </div>

            {/* Stats grid */}
            <div className="mt-3 grid flex-1 grid-cols-2 gap-2">
              <StatPill
                icon={Package}
                label="Produits"
                value={shop.totalProducts.toLocaleString("fr-FR")}
              />
              <StatPill
                icon={Award}
                label="Meilleur prix"
                value={shop.cheapestCount.toLocaleString("fr-FR")}
                tone="emerald"
              />

              {shop.avgPrice != null && shop.avgPrice > 0 && (
                <StatPill
                  icon={TrendingUp}
                  label="Prix moyen"
                  value={`${fmtPrice(shop.avgPrice)} DT`}
                  tone="gold"
                />
              )}

              {shop.similarProducts != null && (
                <StatPill
                  icon={Package}
                  label="En concurrence"
                  value={shop.similarProducts.toLocaleString("fr-FR")}
                  tone="blue"
                />
              )}

              {shop.promoPct != null && (
                <StatPill
                  icon={Percent}
                  label="Taux promo"
                  value={`${shop.promoPct}%`}
                  tone="red"
                />
              )}

              {shop.cheapestRatePct != null && (
                <StatPill
                  icon={Zap}
                  label="Win rate"
                  value={`${shop.cheapestRatePct.toFixed(1)}%`}
                  tone="emerald"
                />
              )}

              {shop.score != null && (
                <StatPill
                  icon={Trophy}
                  label="Score"
                  value={`${shop.score}/100`}
                  tone="gold"
                />
              )}

              {shop.crossedProducts != null && (
                <StatPill
                  icon={TrendingUp}
                  label="Produits croisés"
                  value={shop.crossedProducts.toLocaleString("fr-FR")}
                  tone="blue"
                />
              )}
            </div>

            {/* Flip back hint */}
            <div className="mt-2 flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/40">
              <RotateCw className="h-3 w-3" />
              Retour
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
