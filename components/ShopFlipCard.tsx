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

function safeNum(n: number | undefined | null): number {
  return typeof n === "number" && isFinite(n) ? n : 0;
}

function fmtCount(n: number | undefined | null): string {
  return safeNum(n).toLocaleString("fr-FR");
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
        className="flex items-center justify-center rounded-2xl bg-slate-200 font-black text-slate-600 dark:bg-white/10 dark:text-white/70"
        style={{ width: size, height: size, fontSize: size * 0.28 }}
      >
        {initials || "?"}
      </div>
    );
  }
  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md dark:border-white/10"
      style={{ width: size, height: size, padding: Math.round(size * 0.12) }}
    >
      <img
        src={src}
        alt={name}
        className="h-full w-full object-contain"
        style={{ width: size - Math.round(size * 0.24), height: size - Math.round(size * 0.24) }}
        onError={() => setBroken(true)}
      />
    </div>
  );
}

function StatRow({
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
    default: "border-slate-200/70 bg-slate-50/80 dark:border-white/10 dark:bg-white/[0.04]",
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
    <div className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 ${tones[tone]}`}>
      <div className="flex items-center gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/60 dark:bg-white/[0.06]`}>
          <Icon className={`h-4 w-4 ${iconTones[tone]}`} strokeWidth={2.2} />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">
          {label}
        </span>
      </div>
      <span className="text-[15px] font-black tabular-nums text-slate-900 dark:text-white">
        {value}
      </span>
    </div>
  );
}

export function ShopFlipCard({ shop, category }: { shop: ShopStat; category: string }) {
  const [flipped, setFlipped] = useState(false);

  const stats: { icon: any; label: string; value: string; tone: "default" | "gold" | "emerald" | "blue" | "red" }[] = [
    { icon: Package, label: "Produits", value: fmtCount(shop.totalProducts), tone: "default" },
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
      className="group relative h-[380px] [perspective:1600px] cursor-pointer"
      onClick={() => setFlipped((f) => !f)}
    >
      <div
        className={`relative h-full w-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d] ${
          flipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        {/* ════════════════════════════════════════════════════
            FRONT
           ════════════════════════════════════════════════════ */}
        <div className="absolute inset-0 [backface-visibility:hidden]">
          <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-bg-border bg-bg-card shadow-card transition-all duration-300 hover:border-brand-gold/40 hover:shadow-[0_12px_40px_-12px_rgba(246,196,83,0.35)] hover:-translate-y-1.5">

            {/* ── Top banner with gradient + rank ── */}
            <div className="relative flex h-28 shrink-0 items-center justify-between px-5 bg-gradient-to-r from-bg-700 via-bg-800 to-bg-700 dark:from-bg-800 dark:via-bg-900 dark:to-bg-800">
              <div className="absolute inset-0 bg-gradient-to-r from-brand-red/8 via-transparent to-brand-gold/8" />
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand-gold/10 blur-2xl" />
              <div className="pointer-events-none absolute -left-6 -bottom-6 h-28 w-28 rounded-full bg-brand-red/10 blur-2xl" />

              {/* Rank badge */}
              <div className="relative flex flex-col items-center gap-1">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-black ${rankBadgeClass(shop.rank)}`}
                >
                  {shop.rank === 1 ? <Trophy className="h-5 w-5" strokeWidth={2.25} /> : shop.rank}
                </span>
                <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/40">
                  Rank
                </span>
              </div>

              {/* Flip hint */}
              <div className="relative flex items-center gap-1.5 rounded-full border border-bg-border bg-bg-card/80 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 transition group-hover:border-brand-gold/40 group-hover:text-brand-gold dark:text-white/40">
                <RotateCw className="h-3 w-3" />
                Voir stats
              </div>
            </div>

            {/* ── Logo zone — large, centered ── */}
            <div className="relative flex flex-1 flex-col items-center justify-center gap-5 px-5 py-6">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-gold/20 to-transparent" />

              <div className="relative">
                {/* Glow behind logo */}
                <div className="absolute inset-0 -z-10 scale-110 rounded-full bg-brand-gold/8 blur-xl" />
                <ShopLogoImg src={shop.logo} name={shop.displayName} size={120} />
              </div>

              {/* Name + product count */}
              <div className="text-center">
                <h3 className="text-xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">
                  {shop.displayName}
                </h3>
                <p className="mt-1.5 text-[13px] text-slate-500 dark:text-white/50">
                  {fmtCount(shop.totalProducts)} produits suivis
                </p>
              </div>

              {/* Highlight stat pill */}
              <div className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2">
                <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                <span className="text-[13px] font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                  {fmtCount(shop.cheapestCount)} meilleurs prix
                </span>
              </div>
            </div>

            {/* ── Footer category strip ── */}
            <div className="flex shrink-0 items-center justify-center gap-2 border-t border-bg-border bg-bg-700/50 px-4 py-2.5 dark:border-white/5 dark:bg-bg-800/50">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-gold/60" />
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-white/40">
                {category}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-brand-gold/60" />
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════
            BACK
           ════════════════════════════════════════════════════ */}
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-brand-gold/30 bg-gradient-to-br from-bg-card via-bg-800 to-bg-900 shadow-card">

            {/* ── Header bar ── */}
            <div className="relative flex shrink-0 items-center justify-between gap-2 border-b border-brand-gold/20 bg-gradient-to-r from-brand-gold/10 via-transparent to-brand-gold/10 px-4 py-3.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <ShopLogoImg src={shop.logo} name={shop.displayName} size={40} />
                <div className="min-w-0">
                  <h3 className="truncate text-[15px] font-black text-slate-900 dark:text-white">
                    {shop.displayName}
                  </h3>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/40">
                    #{shop.rank} · {category}
                  </p>
                </div>
              </div>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[11px] font-black ${rankBadgeClass(shop.rank)}`}
              >
                {shop.rank === 1 ? <Trophy className="h-4 w-4" strokeWidth={2.25} /> : shop.rank}
              </span>
            </div>

            {/* ── Stats list (scrollable) ── */}
            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3 [scrollbar-width:thin]">
              {stats.map((s, i) => (
                <StatRow key={i} icon={s.icon} label={s.label} value={s.value} tone={s.tone} />
              ))}
            </div>

            {/* ── Footer ── */}
            <div className="flex shrink-0 items-center justify-center gap-1.5 border-t border-brand-gold/20 bg-brand-gold/5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 transition group-hover:text-brand-gold dark:text-white/40">
              <RotateCw className="h-3 w-3" />
              Retour
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
