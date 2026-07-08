"use client";

import { useState } from "react";
import { RotateCw, Trophy, Zap, Package, TrendingUp, Award, Percent, BarChart3 } from "lucide-react";

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

/* ── helpers ── */

function safeNum(n: number | undefined | null): number {
  return typeof n === "number" && isFinite(n) ? n : 0;
}

function fmtCount(n: number | undefined | null): string {
  return safeNum(n).toLocaleString("fr-FR");
}

function fmtPrice(n: number): string {
  if (n >= 1000) return Math.round(n).toLocaleString("fr-FR");
  return n.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
}

/* ── rank badge ── */

const RANK_STYLES: Record<number, { badge: string; ring: string }> = {
  1: {
    badge: "bg-gradient-to-br from-yellow-400 to-amber-600 text-yellow-950 shadow-[0_2px_12px_rgba(246,196,83,0.5)] ring-1 ring-yellow-300/50",
    ring: "ring-amber-400/40",
  },
  2: {
    badge: "bg-gradient-to-br from-slate-300 to-slate-500 text-slate-900 shadow-sm ring-1 ring-slate-300/60",
    ring: "ring-slate-300/30",
  },
  3: {
    badge: "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-sm ring-1 ring-orange-400/50",
    ring: "ring-orange-400/30",
  },
};

function rankStyle(rank: number) {
  if (rank <= 3) return RANK_STYLES[rank];
  return {
    badge: "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-white/70",
    ring: "",
  };
}

/* ── logo ── */

function ShopLogo({ src, name, size = 96 }: { src: string | null; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const pad = Math.round(size * 0.14);
  const imgSize = size - pad * 2;

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
        className="flex items-center justify-center rounded-2xl bg-slate-100 font-black text-slate-500 dark:bg-white/10 dark:text-white/60"
        style={{ width: size, height: size, fontSize: size * 0.26 }}
      >
        {initials || "?"}
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-white/10"
      style={{ width: size, height: size, padding: pad }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name}
        style={{ width: imgSize, height: imgSize }}
        className="object-contain"
        onError={() => setBroken(true)}
      />
    </div>
  );
}

/* ── stat row for back ── */

type StatTone = "neutral" | "gold" | "emerald" | "blue" | "red";

const STAT_TONES: Record<StatTone, { bg: string; icon: string }> = {
  neutral: {
    bg: "border-slate-200/60 bg-slate-50/60 dark:border-white/[0.06] dark:bg-white/[0.03]",
    icon: "text-slate-500 dark:text-white/50",
  },
  gold: {
    bg: "border-brand-gold/25 bg-brand-gold/[0.07] dark:border-brand-gold/20",
    icon: "text-brand-gold",
  },
  emerald: {
    bg: "border-emerald-500/20 bg-emerald-500/[0.07] dark:border-emerald-500/20",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  blue: {
    bg: "border-blue-500/20 bg-blue-500/[0.07] dark:border-blue-500/20",
    icon: "text-blue-600 dark:text-blue-400",
  },
  red: {
    bg: "border-red-500/20 bg-red-500/[0.07] dark:border-red-500/20",
    icon: "text-red-500 dark:text-red-400",
  },
};

function StatRow({ icon: Icon, label, value, tone = "neutral" }: { icon: any; label: string; value: string; tone?: StatTone }) {
  const t = STAT_TONES[tone];
  return (
    <div className={`flex h-11 items-center justify-between rounded-xl border px-3 ${t.bg}`}>
      <div className="flex items-center gap-2.5">
        <Icon className={`h-4 w-4 shrink-0 ${t.icon}`} strokeWidth={2.2} />
        <span className="text-[12px] font-semibold text-slate-600 dark:text-white/55">{label}</span>
      </div>
      <span className="text-[14px] font-black tabular-nums text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

/* ── main card ── */

export function ShopFlipCard({ shop, category }: { shop: ShopStat; category: string }) {
  const [flipped, setFlipped] = useState(false);
  const rs = rankStyle(shop.rank);

  const stats: { icon: any; label: string; value: string; tone: StatTone }[] = [
    { icon: Package, label: "Produits suivis", value: fmtCount(shop.totalProducts), tone: "neutral" },
    { icon: Award, label: "Meilleur prix", value: fmtCount(shop.cheapestCount), tone: "emerald" },
  ];

  if (shop.avgPrice != null && shop.avgPrice > 0)
    stats.push({ icon: TrendingUp, label: "Prix moyen", value: `${fmtPrice(safeNum(shop.avgPrice))} DT`, tone: "gold" });

  if (shop.similarProducts != null)
    stats.push({ icon: BarChart3, label: "En concurrence", value: fmtCount(shop.similarProducts), tone: "blue" });

  if (shop.promoPct != null)
    stats.push({ icon: Percent, label: "Taux promo", value: `${shop.promoPct}%`, tone: "red" });

  if (shop.cheapestRatePct != null)
    stats.push({ icon: Zap, label: "Win rate", value: `${safeNum(shop.cheapestRatePct).toFixed(1)}%`, tone: "emerald" });

  if (shop.score != null)
    stats.push({ icon: Trophy, label: "Score global", value: `${shop.score}/100`, tone: "gold" });

  if (shop.crossedProducts != null)
    stats.push({ icon: TrendingUp, label: "Produits croisés", value: fmtCount(shop.crossedProducts), tone: "blue" });

  return (
    <div
      className="group relative h-[340px] cursor-pointer [perspective:1500px]"
      onClick={() => setFlipped((f) => !f)}
    >
      <div
        className={`relative h-full w-full transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d] ${
          flipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        {/* ════════════ FRONT ════════════ */}
        <div className="absolute inset-0 [backface-visibility:hidden]">
          <div className={`flex h-full flex-col overflow-hidden rounded-2xl border border-bg-border bg-bg-card shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_12px_36px_-10px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_12px_36px_-10px_rgba(246,196,83,0.2)] hover:border-brand-gold/35 ${rs.ring}`}>

            {/* ── top bar: rank + flip hint ── */}
            <div className="flex h-12 shrink-0 items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-black ${rs.badge}`}>
                  {shop.rank === 1 ? <Trophy className="h-3.5 w-3.5" strokeWidth={2.5} /> : shop.rank}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">
                  #{shop.rank}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-300 transition group-hover:text-brand-gold dark:text-white/25">
                <RotateCw className="h-3 w-3" />
                Stats
              </div>
            </div>

            {/* ── logo + name + key stat ── */}
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-2">
              <div className="relative">
                <div className="absolute inset-0 -z-10 rounded-full bg-brand-gold/[0.06] blur-2xl" />
                <ShopLogo src={shop.logo} name={shop.displayName} size={96} />
              </div>

              <div className="text-center">
                <h3 className="text-lg font-black leading-tight tracking-tight text-slate-900 dark:text-white">
                  {shop.displayName}
                </h3>
                <p className="mt-1 text-[12px] text-slate-500 dark:text-white/45">
                  {fmtCount(shop.totalProducts)} produits
                </p>
              </div>

              <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5">
                <Zap className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                <span className="text-[12px] font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                  {fmtCount(shop.cheapestCount)} meilleurs prix
                </span>
              </div>
            </div>

            {/* ── bottom category strip ── */}
            <div className="flex h-10 shrink-0 items-center justify-center border-t border-bg-border bg-slate-50/60 dark:bg-white/[0.02] dark:border-white/[0.05]">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-white/35">
                {category}
              </span>
            </div>
          </div>
        </div>

        {/* ════════════ BACK ════════════ */}
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-brand-gold/25 bg-gradient-to-b from-bg-card to-bg-800 shadow-card">

            {/* ── header ── */}
            <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-bg-border bg-slate-50/50 px-3.5 dark:bg-white/[0.02] dark:border-white/[0.06]">
              <div className="flex min-w-0 items-center gap-2">
                <ShopLogo src={shop.logo} name={shop.displayName} size={32} />
                <div className="min-w-0">
                  <h3 className="truncate text-[14px] font-black text-slate-900 dark:text-white">
                    {shop.displayName}
                  </h3>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/35">
                    {category}
                  </p>
                </div>
              </div>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${rs.badge}`}>
                {shop.rank === 1 ? <Trophy className="h-3.5 w-3.5" strokeWidth={2.5} /> : shop.rank}
              </span>
            </div>

            {/* ── stats ── */}
            <div className="flex-1 space-y-1.5 overflow-y-auto px-3.5 py-3 [scrollbar-width:thin]">
              {stats.map((s, i) => (
                <StatRow key={i} icon={s.icon} label={s.label} value={s.value} tone={s.tone} />
              ))}
            </div>

            {/* ── footer ── */}
            <div className="flex h-10 shrink-0 items-center justify-center gap-1.5 border-t border-bg-border bg-brand-gold/[0.04] dark:border-white/[0.05]">
              <RotateCw className="h-3 w-3 text-slate-400 transition group-hover:text-brand-gold dark:text-white/35" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 transition group-hover:text-brand-gold dark:text-white/35">
                Retour
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
