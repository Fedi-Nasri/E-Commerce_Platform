"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Layers,
  Loader2,
  Package,
  Trophy,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ShopLogo } from "@/components/shop/ShopLogo";
import { fmtTickerPrice } from "@/lib/shopAvgPriceUtils";
import type { ShopCatalogDetail } from "@/lib/shopCatalogDetail";

const GOLD = "#f6c453";
const GOLD_DIM = "rgba(246,196,83,0.35)";
const CHART_TICK = "#94a3b8";
const CHART_GRID = "rgba(148,163,184,0.18)";

const panelCard =
  "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#141c2e]";
const kpiCard =
  "rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-white/10 dark:bg-[#141c2e]";

function fmt(n: number) {
  return n.toLocaleString("fr-FR");
}

function KpiCard({
  icon: Icon,
  label,
  value,
  helper,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  helper?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={kpiCard}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand-gold" />
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-white/55">
          {label}
        </span>
      </div>
      <div className="mt-2 text-2xl font-black tabular-nums tracking-tight text-slate-900 dark:text-white">
        {value}
      </div>
      {helper ? (
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-white/60">{helper}</p>
      ) : null}
    </motion.div>
  );
}

function BucketTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { label: string; count: number; pct: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg backdrop-blur-sm dark:border-white/10 dark:bg-[#141c2e]">
      <div className="font-bold text-slate-900 dark:text-white">{d.label}</div>
      <div className="mt-1 text-slate-600 dark:text-white/75">
        {fmt(d.count)} produits · {d.pct}%
      </div>
    </div>
  );
}

function PeerTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { displayName: string; avg_price: number; product_count: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm dark:border-white/10 dark:bg-bg-800">
      <div className="font-bold text-slate-900 dark:text-white">{d.displayName}</div>
      <div className="mt-1 text-slate-600 dark:text-white/70">
        {fmtTickerPrice(d.avg_price)} DT · {fmt(d.product_count)} en stock
      </div>
    </div>
  );
}

export function ShopCatalogStatsPanel({
  shopKey,
  open,
  onClose,
}: {
  shopKey: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<ShopCatalogDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !shopKey) return;

    setLoading(true);
    setError(null);
    setDetail(null);

    fetch(`/api/stats/shop-catalog-detail?shop=${encodeURIComponent(shopKey)}`)
      .then((r) => {
        if (!r.ok) throw new Error("not_found");
        return r.json();
      })
      .then((d: ShopCatalogDetail) => setDetail(d))
      .catch(() => setError("Impossible de charger les statistiques de cette enseigne."))
      .finally(() => setLoading(false));
  }, [open, shopKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const marketBars = useMemo(() => {
    if (!detail) return [];
    return [
      { label: "Cette enseigne", value: detail.shop.avg_price, highlight: true },
      { label: "Médiane marché", value: detail.market.medianAvgPrice, highlight: false },
    ];
  }, [detail]);

  return (
    <AnimatePresence>
      {open && shopKey ? (
        <motion.div
          className="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            aria-label="Fermer"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shop-stats-title"
            className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-slate-200/80 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0d1220] sm:rounded-3xl"
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-brand-gold/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />

            <div className="relative border-b border-slate-200/80 px-5 py-4 dark:border-white/[0.08] sm:px-6">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-brand-gold/40 hover:text-brand-gold dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
              >
                <X className="h-4 w-4" />
              </button>

              {loading ? (
                <div className="flex items-center gap-3 py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-gold" />
                  <span className="text-sm font-semibold text-slate-500 dark:text-white/55">
                    Chargement des statistiques…
                  </span>
                </div>
              ) : error ? (
                <div className="py-8 text-center text-sm text-slate-500 dark:text-white/50">{error}</div>
              ) : detail ? (
                <div className="flex items-center gap-4 pr-12">
                  <ShopLogo shopKey={detail.shop.shop_key} size={56} className="ring-2 ring-brand-gold/25" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-gold">
                      Fiche catalogue
                    </p>
                    <h2 id="shop-stats-title" className="truncate text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
                      {detail.displayName}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-white/50">
                      Prix moyen calculé sur les produits en stock uniquement
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {detail && !loading && !error ? (
              <div className="relative overflow-y-auto px-5 py-5 sm:px-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <KpiCard
                    icon={BarChart3}
                    label="Prix moyen"
                    value={`${fmtTickerPrice(detail.shop.avg_price)} DT`}
                    helper={`Rang ${detail.market.avgPriceRank} / ${detail.market.shopCount} enseignes`}
                    delay={0.05}
                  />
                  <KpiCard
                    icon={Package}
                    label="Catalogue en stock"
                    value={fmt(detail.shop.product_count)}
                    helper={`${detail.market.catalogSharePct}% du marché suivi`}
                    delay={0.1}
                  />
                  <KpiCard
                    icon={Layers}
                    label="Accessibilité"
                    value={`${detail.market.accessibilityPct}%`}
                    helper="Moins cher que ce pourcentage d'enseignes"
                    delay={0.15}
                  />
                  <KpiCard
                    icon={Trophy}
                    label="Classement taille"
                    value={`#${detail.market.catalogRank}`}
                    helper={`Sur ${detail.market.shopCount} catalogues retail`}
                    delay={0.2}
                  />
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.22 }}
                    className={panelCard}
                  >
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Position prix marché</h3>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-white/50">
                      Comparaison du prix moyen catalogue avec la médiane des enseignes suivies.
                    </p>
                    <div className="mt-4 h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={marketBars} layout="vertical" margin={{ left: 8, right: 12, top: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_GRID} />
                          <XAxis type="number" tick={{ fontSize: 10, fill: CHART_TICK }} />
                          <YAxis type="category" dataKey="label" width={96} tick={{ fontSize: 10, fill: CHART_TICK }} />
                          <Tooltip
                            formatter={(v: number) => [`${fmtTickerPrice(v)} DT`, "Prix moyen"]}
                            contentStyle={{
                              borderRadius: 12,
                              border: "1px solid rgba(148,163,184,0.25)",
                              background: "var(--bg-card, #141c2e)",
                              color: "var(--text-primary, #f8fafc)",
                            }}
                            labelStyle={{ color: "var(--text-primary, #f8fafc)" }}
                          />
                          <Bar dataKey="value" radius={[0, 8, 8, 0]} animationDuration={900} animationEasing="ease-out">
                            {marketBars.map((entry) => (
                              <Cell key={entry.label} fill={entry.highlight ? GOLD : "#64748b"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.28 }}
                    className={panelCard}
                  >
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Enseignes comparables</h3>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-white/50">
                      Prix moyen des catalogues de taille proche (produits en stock).
                    </p>
                    <div className="mt-4 h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={detail.peers} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                          <XAxis
                            dataKey="displayName"
                            tick={{ fontSize: 9, fill: CHART_TICK }}
                            interval={0}
                            angle={-18}
                            textAnchor="end"
                            height={52}
                          />
                          <YAxis tick={{ fontSize: 10, fill: CHART_TICK }} />
                          <Tooltip content={<PeerTooltip />} />
                          <Bar dataKey="avg_price" radius={[8, 8, 0, 0]} animationDuration={950} animationEasing="ease-out">
                            {detail.peers.map((p) => (
                              <Cell key={p.shop_key} fill={p.isSelected ? GOLD : GOLD_DIM} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                </div>

                {detail.priceBuckets && detail.priceBuckets.some((b) => b.count > 0) ? (
                  <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.34 }}
                    className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-bg-800"
                  >
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Répartition des prix en stock</h3>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-white/50">
                      Distribution du catalogue par tranche de prix (produits disponibles uniquement).
                    </p>
                    <div className="mt-4 h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={detail.priceBuckets} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                          <XAxis dataKey="label" tick={{ fontSize: 9, fill: CHART_TICK }} interval={0} />
                          <YAxis tick={{ fontSize: 10, fill: CHART_TICK }} />
                          <Tooltip content={<BucketTooltip />} />
                          <Bar
                            dataKey="count"
                            fill={GOLD}
                            radius={[8, 8, 0, 0]}
                            animationDuration={1100}
                            animationEasing="ease-out"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                ) : null}

                {detail.competitive ? (
                  <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 dark:border-emerald-500/20 dark:bg-emerald-950/40"
                  >
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Performance comparative</h3>
                    <p className="mt-1 text-[11px] text-slate-600 dark:text-white/60">
                      Produits comparables en stock face aux autres enseignes (classement retail 1111).
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {[
                        { label: "Meilleurs prix", value: fmt(detail.competitive!.cheapestCount) },
                        { label: "Taux de victoire", value: `${detail.competitive!.winRatePct}%` },
                        { label: "Produits comparés", value: fmt(detail.competitive!.totalProducts) },
                      ].map((item, i) => (
                        <motion.div
                          key={item.label}
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.45 + i * 0.06 }}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center dark:border-white/10 dark:bg-[#0d1220]"
                        >
                          <div className="text-lg font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                            {item.value}
                          </div>
                          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/55">
                            {item.label}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ) : null}

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.48 }}
                  className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-4 dark:border-white/[0.08]"
                >
                  <p className="text-[11px] text-slate-500 dark:text-white/45">
                    Valeur totale catalogue :{" "}
                    <strong className="text-slate-800 dark:text-white/80">
                      {fmtTickerPrice(detail.shop.price_sum)} DT
                    </strong>
                  </p>
                  <Link
                    href={`/boutiques/${detail.shop.shop_key}`}
                    onClick={onClose}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-gold px-5 py-2.5 text-sm font-bold text-black transition hover:bg-brand-gold/90"
                  >
                    Voir le catalogue
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
