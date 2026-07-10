"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  ChevronUp,
  GitCompareArrows,
  Info,
  Layers,
  Store,
  Trophy,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

type ShopRow = {
  shop: string;
  displayName: string;
  logo: string | null;
  rank: number;
  totalProducts: number;
  cheapestCount: number;
  winRatePct: number;
};

type CategoryRow = {
  slug: string;
  label: string;
  clusterCount: number;
  leader: string | null;
  leaderName: string | null;
  shops: {
    shop: string;
    displayName: string;
    logo: string | null;
    totalProducts: number;
    cheapestCount: number;
    winRatePct: number;
  }[];
};

export type RetailRankingDetailProps = {
  generatedAt: string;
  method: string;
  clustersUsed: number;
  scrapesUsed: number | null;
  minProducts: number;
  minProductsList: number;
  inStockOnly: boolean;
  shops: ShopRow[];
  top5: ShopRow[];
  categories: CategoryRow[];
};

const EMERALD = "#10b981";
const EMERALD_LIGHT = "#34d399";
const SLATE = "#94a3b8";

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

function shortLabel(name: string, max = 14) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-white/[0.08] dark:bg-bg-800">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
      {subtitle ? (
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-white/50">{subtitle}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function WinRateTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; wins: number; total: number; winRate: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm dark:border-white/10 dark:bg-bg-800/95">
      <div className="font-bold text-slate-900 dark:text-white">{d.name}</div>
      <div className="mt-1 text-slate-600 dark:text-white/70">
        Meilleurs prix : <strong>{d.wins.toLocaleString("fr-FR")}</strong>
        {" / "}
        {d.total.toLocaleString("fr-FR")}
      </div>
      <div className="text-emerald-600 dark:text-emerald-400">
        Taux : <strong>{d.winRate}%</strong>
      </div>
    </div>
  );
}

function ScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; total: number; winRate: number; wins: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm dark:border-white/10 dark:bg-bg-800/95">
      <div className="font-bold text-slate-900 dark:text-white">{d.name}</div>
      <div className="mt-1 text-slate-600 dark:text-white/70">
        {d.wins.toLocaleString("fr-FR")} victoires · {d.total.toLocaleString("fr-FR")} produits
      </div>
      <div className="text-emerald-600 dark:text-emerald-400">Taux : {d.winRate}%</div>
    </div>
  );
}

export function RetailRankingDetail({
  generatedAt,
  method,
  clustersUsed,
  scrapesUsed,
  minProducts,
  minProductsList,
  inStockOnly,
  shops,
  top5,
  categories,
}: RetailRankingDetailProps) {
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const updated = fmtDate(generatedAt);
  const leader = shops[0];

  const top15Chart = useMemo(
    () =>
      shops.slice(0, 15).map((s) => ({
        key: s.shop,
        name: shortLabel(s.displayName),
        fullName: s.displayName,
        wins: s.cheapestCount,
        total: s.totalProducts,
        winRate: s.winRatePct,
      })),
    [shops],
  );

  const scatterData = useMemo(
    () =>
      shops.map((s) => ({
        key: s.shop,
        name: s.displayName,
        total: s.totalProducts,
        winRate: s.winRatePct,
        wins: s.cheapestCount,
        z: Math.max(s.cheapestCount / 20, 40),
      })),
    [shops],
  );

  const categoryChart = useMemo(() => {
    const cats = categories
      .filter((c) => c.slug !== "non-categorise")
      .slice(0, 12)
      .map((c) => {
        const top = c.shops[0];
        return {
          slug: c.slug,
          label: shortLabel(c.label, 18),
          fullLabel: c.label,
          clusterCount: c.clusterCount,
          leader: c.leaderName ?? "—",
          winRate: top?.winRatePct ?? 0,
          wins: top?.cheapestCount ?? 0,
        };
      });
    return cats;
  }, [categories]);

  const visibleCategories = categories.filter((c) => c.clusterCount >= 30);

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 p-5 sm:p-8 dark:border-emerald-500/20 dark:from-emerald-950/90 dark:via-slate-950/95 dark:to-slate-950">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-500/20" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700/90 dark:text-emerald-400/80">
          Classement retail · Prix comparés
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
          Quelle boutique retail propose le plus souvent le meilleur prix ?
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-white/65">
          Analyse sur <strong className="text-slate-800 dark:text-white/90">{clustersUsed.toLocaleString("fr-FR")} produits identiques</strong>{" "}
          trouvés chez au moins 2 enseignes, avec offres{" "}
          <strong className="text-slate-800 dark:text-white/90">en stock</strong> selon le dernier scrape de chaque boutique.
        </p>
        {leader ? (
          <p className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <Trophy className="mr-1 inline h-4 w-4 text-amber-500" />
            {leader.displayName} en tête — {leader.cheapestCount.toLocaleString("fr-FR")} meilleurs prix sur{" "}
            {leader.totalProducts.toLocaleString("fr-FR")} produits comparables ({leader.winRatePct}%).
          </p>
        ) : null}
        {updated ? (
          <p className="mt-2 text-[11px] text-slate-500 dark:text-white/40">Dernière analyse · {updated}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          { icon: GitCompareArrows, label: "Produits comparés", value: clustersUsed.toLocaleString("fr-FR") },
          { icon: Store, label: "Boutiques classées", value: String(shops.length) },
          { icon: BarChart3, label: "Scrapes utilisés", value: scrapesUsed ? String(scrapesUsed) : "—" },
          { icon: Layers, label: "Catégories analysées", value: String(visibleCategories.length) },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-bg-800"
          >
            <s.icon className="mb-2 h-4 w-4 text-emerald-500" />
            <p className="text-xl font-black tabular-nums text-slate-900 dark:text-white">{s.value}</p>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-white/50">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Top 15 — Meilleurs prix (volume)"
          subtitle="Nombre de fois où l'enseigne affiche le prix le plus bas sur un produit comparable en stock."
        >
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={top15Chart} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: SLATE }} />
              <YAxis
                type="category"
                dataKey="name"
                width={88}
                tick={{ fontSize: 10, fill: SLATE }}
              />
              <Tooltip content={<WinRateTooltip />} />
              <Bar dataKey="wins" radius={[0, 6, 6, 0]} animationDuration={900} animationEasing="ease-out">
                {top15Chart.map((_, i) => (
                  <Cell
                    key={_.key}
                    fill={i === 0 ? EMERALD : i < 5 ? EMERALD_LIGHT : "rgba(16,185,129,0.55)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Top 15 — Taux de victoires (%)"
          subtitle="Part des produits comparables où l'enseigne est la moins chère (ex æquo partagé)."
        >
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={top15Chart} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
              <XAxis type="number" domain={[0, 55]} tick={{ fontSize: 10, fill: SLATE }} unit="%" />
              <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 10, fill: SLATE }} />
              <Tooltip content={<WinRateTooltip />} />
              <Bar dataKey="winRate" radius={[0, 6, 6, 0]} animationDuration={1000} animationEasing="ease-out">
                {top15Chart.map((_, i) => (
                  <Cell
                    key={_.key}
                    fill={i === 0 ? "#f59e0b" : i < 5 ? "#fbbf24" : "rgba(245,158,11,0.5)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Carte des enseignes"
          subtitle="Axe X : produits comparables · Axe Y : taux de victoires · Taille : volume de meilleurs prix."
        >
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis
                type="number"
                dataKey="total"
                name="Produits"
                tick={{ fontSize: 10, fill: SLATE }}
                label={{ value: "Produits comparables", position: "insideBottom", offset: -2, fontSize: 10, fill: SLATE }}
              />
              <YAxis
                type="number"
                dataKey="winRate"
                name="Taux"
                unit="%"
                tick={{ fontSize: 10, fill: SLATE }}
                label={{ value: "Taux %", angle: -90, position: "insideLeft", fontSize: 10, fill: SLATE }}
              />
              <ZAxis type="number" dataKey="z" range={[50, 400]} />
              <Tooltip content={<ScatterTooltip />} />
              <Scatter
                data={scatterData}
                fill={EMERALD}
                fillOpacity={0.65}
                animationDuration={1100}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Leaders par catégorie"
          subtitle="Taux de victoires du #1 dans chaque catégorie retail (hors non catégorisé)."
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={categoryChart} margin={{ top: 8, right: 8, left: 0, bottom: 56 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: SLATE }}
                angle={-35}
                textAnchor="end"
                height={70}
                interval={0}
              />
              <YAxis tick={{ fontSize: 10, fill: SLATE }} unit="%" domain={[0, 60]} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof categoryChart)[0];
                  return (
                    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-bg-800/95">
                      <div className="font-bold text-slate-900 dark:text-white">{d.fullLabel}</div>
                      <div className="mt-1 text-slate-600 dark:text-white/70">
                        {d.clusterCount.toLocaleString("fr-FR")} produits comparés
                      </div>
                      <div className="text-emerald-600 dark:text-emerald-400">
                        Leader : {d.leader} ({d.winRate}%)
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="winRate" radius={[6, 6, 0, 0]} fill={EMERALD} animationDuration={950} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-50/60 to-white p-5 dark:from-emerald-950/30 dark:to-bg-800 dark:border-emerald-500/15">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Podium — Top 5 (accueil)</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-white/50">
          Même classement que la carte d&apos;accueil, détaillé ici avec barres animées.
        </p>
        <ul className="mt-4 space-y-2">
          {top5.map((s, i) => (
            <li
              key={s.shop}
              className={`retail-row-enter rounded-xl border border-slate-200/90 bg-white/90 p-3 dark:border-white/5 dark:bg-bg-800/90 ${
                i === 0 ? "retail-champion-glow border-emerald-400/30" : ""
              }`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center gap-3">
                <span className="w-6 shrink-0 text-center text-sm font-black tabular-nums text-slate-400">{i + 1}</span>
                {s.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logo} alt="" className="h-10 w-10 shrink-0 object-contain" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold dark:bg-white/10">
                    {s.displayName.slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{s.displayName}</div>
                  <div className="text-[11px] tabular-nums text-slate-500 dark:text-white/50">
                    {s.cheapestCount.toLocaleString("fr-FR")} / {s.totalProducts.toLocaleString("fr-FR")} produits
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                    {s.winRatePct}%
                  </div>
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                <div
                  className="retail-win-bar h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                  style={{ width: `${s.winRatePct}%`, animationDelay: `${i * 70 + 100}ms` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white dark:border-white/[0.08] dark:bg-bg-800">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-white/[0.06]">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Toutes les boutiques comparées ({shops.length})
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-white/50">
            Enseignes avec au moins {minProductsList} produits comparables en stock.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/[0.06]">
                <th className="px-5 py-3 font-semibold">#</th>
                <th className="px-3 py-3 font-semibold">Boutique</th>
                <th className="px-3 py-3 font-semibold text-right">Produits</th>
                <th className="px-3 py-3 font-semibold text-right">Meilleurs prix</th>
                <th className="px-3 py-3 font-semibold text-right">Taux</th>
                <th className="px-3 py-3 font-semibold w-32">Part</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((s, i) => (
                <tr key={s.shop} className="border-b border-slate-50 last:border-0 dark:border-white/[0.04]">
                  <td className="px-5 py-3 font-bold tabular-nums text-slate-400">{s.rank}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      {s.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.logo} alt="" className="h-8 w-8 object-contain" />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-xs font-bold dark:bg-white/10">
                          {s.displayName.slice(0, 1)}
                        </span>
                      )}
                      <span className="font-semibold text-slate-800 dark:text-white/90">{s.displayName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600 dark:text-white/70">
                    {s.totalProducts.toLocaleString("fr-FR")}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-800 dark:text-white/90">
                    {s.cheapestCount.toLocaleString("fr-FR")}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                        i === 0
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-white/60"
                      }`}
                    >
                      {s.winRatePct}%
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-emerald-500/80"
                        style={{ width: `${s.winRatePct}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white dark:border-white/[0.08] dark:bg-bg-800">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-white/[0.06]">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Détail par catégorie</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-white/50">
            Classement interne par famille de produits (smartphones, PC, TV, climatiseurs, etc.).
          </p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
          {visibleCategories.map((cat) => {
            const open = expandedCat === cat.slug;
            const catLeader = cat.shops[0];
            return (
              <div key={cat.slug}>
                <button
                  type="button"
                  onClick={() => setExpandedCat(open ? null : cat.slug)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{cat.label}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] tabular-nums text-slate-500 dark:bg-white/5 dark:text-white/50">
                        {cat.clusterCount.toLocaleString("fr-FR")} produits
                      </span>
                    </div>
                    {catLeader ? (
                      <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                        Leader : {catLeader.displayName} — {catLeader.winRatePct}% ({catLeader.cheapestCount.toLocaleString("fr-FR")} victoires)
                      </p>
                    ) : null}
                  </div>
                  {open ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                  )}
                </button>
                {open ? (
                  <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3 dark:border-white/[0.04] dark:bg-white/[0.02]">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[480px] text-left text-xs">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-wide text-slate-400">
                            <th className="pb-2 pr-3 font-semibold">#</th>
                            <th className="pb-2 pr-3 font-semibold">Boutique</th>
                            <th className="pb-2 pr-3 font-semibold text-right">Produits</th>
                            <th className="pb-2 pr-3 font-semibold text-right">Victoires</th>
                            <th className="pb-2 font-semibold text-right">Taux</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cat.shops.map((s, i) => (
                            <tr key={s.shop} className="border-t border-slate-200/60 dark:border-white/[0.04]">
                              <td className="py-2 pr-3 tabular-nums text-slate-400">{i + 1}</td>
                              <td className="py-2 pr-3">
                                <div className="flex items-center gap-2">
                                  {s.logo ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={s.logo} alt="" className="h-5 w-5 object-contain" />
                                  ) : null}
                                  <span className="font-medium text-slate-800 dark:text-white/85">{s.displayName}</span>
                                </div>
                              </td>
                              <td className="py-2 pr-3 text-right tabular-nums">{s.totalProducts.toLocaleString("fr-FR")}</td>
                              <td className="py-2 pr-3 text-right tabular-nums font-semibold">{s.cheapestCount.toLocaleString("fr-FR")}</td>
                              <td className="py-2 text-right">
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{s.winRatePct}%</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/[0.08] dark:bg-bg-800">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Comment le calcul fonctionne</h3>
              <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-600 dark:text-white/65">
                <li>
                  <strong className="text-slate-800 dark:text-white/85">1. Produits identiques</strong> — nous partons de{" "}
                  {clustersUsed.toLocaleString("fr-FR")} clusters de produits reconnus comme identiques entre boutiques
                  (fichier <code className="text-[10px]">product_clusters.json</code>).
                </li>
                <li>
                  <strong className="text-slate-800 dark:text-white/85">2. Filtre en stock</strong> — seules les offres dont
                  l&apos;URL apparaît <em>en stock</em> dans le dernier scrape de chaque enseigne sont comptées
                  {inStockOnly ? " (obligatoire)" : ""}. {scrapesUsed ? `${scrapesUsed} boutiques` : "Les boutiques"} ont été
                  vérifiées.
                </li>
                <li>
                  <strong className="text-slate-800 dark:text-white/85">3. Comparabilité</strong> — un produit entre au
                  calcul seulement s&apos;il est proposé par <strong>au moins 2 enseignes</strong> après filtrage stock, avec un
                  prix valide (&gt; 0 DT).
                </li>
                <li>
                  <strong className="text-slate-800 dark:text-white/85">4. Meilleur prix</strong> — pour chaque produit, on
                  repère le prix minimum. En cas d&apos;<strong>ex æquo</strong>, la victoire est partagée (ex. 2 boutiques à
                  égalité → 0,5 point chacune).
                </li>
                <li>
                  <strong className="text-slate-800 dark:text-white/85">5. Classement global</strong> — tri par{" "}
                  <strong>nombre total de meilleurs prix</strong> (somme des victoires, y compris fractionnaires). Le{" "}
                  <strong>taux %</strong> = victoires ÷ produits comparables de l&apos;enseigne.
                </li>
                <li>
                  <strong className="text-slate-800 dark:text-white/85">6. Catégories</strong> — découpage par famille
                  (smartphones, PC portables, télévisions, climatiseurs, stockage, etc.) via règles sur le libellé catégorie
                  d&apos;origine. Le classement par catégorie utilise la même logique, appliquée au sous-ensemble.
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/[0.08] dark:bg-bg-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Périmètre & limites</h3>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600 dark:text-white/65">
            <li>
              Top 5 accueil : enseignes avec ≥ {minProducts.toLocaleString("fr-FR")} produits comparables.
            </li>
            <li>
              Liste complète : enseignes avec ≥ {minProductsList} produits comparables ({shops.length} retenues).
            </li>
            <li>
              {method}
            </li>
            <li>
              Les produits non matchés entre boutiques ou hors stock ne sont pas inclus — le classement reflète
              l&apos;offre réellement disponible et comparable aujourd&apos;hui.
            </li>
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-bg-800 dark:text-white/80 dark:hover:bg-white/5"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à l&apos;accueil
        </Link>
        <Link
          href="/retail"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          <Store className="h-4 w-4" />
          Explorer le catalogue retail
        </Link>
      </div>
    </div>
  );
}
