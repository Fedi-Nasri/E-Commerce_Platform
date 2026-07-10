"use client";
import { useEffect, useState } from "react";
import { Sparkles, Sun } from "lucide-react";
import Link from "next/link";

type SunscreenOffer = {
  rank: number;
  name: string;
  url: string;
  price: number;
  regular: number | null;
};

type SunscreenData = {
  product: { label: string; subtitle: string; image: string };
  shopsTracked: number;
  offers: SunscreenOffer[];
  maxSavings: number;
  leaderShop: string | null;
};

type ShopStat = {
  shop: string;
  displayName: string;
  products: number;
  comparedProducts?: number;
  catalogProducts?: number | null;
  catalogTotal?: number | null;
  avgPrice: number;
  cheapestCount: number;
  promoCount: number;
  promoPct: number;
  availability: number;
  score: number;
  rank: number;
  logo: string | null;
  visitors: number;
};

const RANK_BG = [
  "bg-yellow-500", // 1
  "bg-blue-500",   // 2
  "bg-red-600",    // 3
  "bg-emerald-600",// 4
  "bg-purple-600", // 5
  "bg-slate-500",  // 6+
];

function fmtPrice(n: number): string {
  return `${n.toFixed(3).replace(/\.?0+$/, "")} DT`;
}

function fmtNumber(n: number): string {
  return n.toLocaleString("fr-FR");
}

export function AcBarometer() {
  const [shops, setShops] = useState<ShopStat[]>([]);
  const [sunscreen, setSunscreen] = useState<SunscreenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sunscreenLoading, setSunscreenLoading] = useState(true);

  useEffect(() => {
    fetch("/api/para-shops-stats")
      .then((r) => r.json())
      .then((d) => setShops((d.shops ?? []).slice(0, 5)))
      .catch(() => setShops([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/para-sunscreen-offers")
      .then((r) => r.json())
      .then((d) => setSunscreen(d))
      .catch(() => setSunscreen(null))
      .finally(() => setSunscreenLoading(false));
  }, []);

  const topRows = shops.map((s, idx) => {
    const positionColor =
      s.score >= 85
        ? "text-emerald-600 dark:text-emerald-400"
        : s.score >= 70
        ? "text-amber-600 dark:text-amber-300"
        : "text-red-500 dark:text-red-400";
    return {
      ...s,
      rankBg: RANK_BG[Math.min(idx, RANK_BG.length - 1)],
      positionColor,
      cheapestStr: fmtNumber(s.cheapestCount),
      catalogStr: fmtNumber(s.catalogProducts ?? s.catalogTotal ?? s.products),
    };
  });
  return (
    <section className="mx-auto mt-5 max-w-[1600px] px-3 sm:px-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[2.5fr_1.5fr]">
        {/* COMPARATEUR PARAPHARMACIE — spans first 2 columns */}
        <div className="card card-pad flex flex-col">
          {/* Title */}
          <div className="mb-4 flex flex-wrap items-baseline gap-3">
            <span className="text-base font-black uppercase tracking-wide text-brand-gold">
              Comparateur de position des sites Parapharmacie
            </span>
            <span className="font-arabic text-sm font-semibold text-brand-gold/80" dir="rtl">
              مقارنة ترتيب مواقع البازفارماسي
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs dark:text-white/40">
                  <th className="pb-3 text-left font-medium">Site</th>
                  <th className="pb-3 text-center font-medium">Meilleurs prix</th>
                  <th className="pb-3 text-center font-medium">Prix moyen</th>
                  <th className="pb-3 text-center font-medium">Produits en catalogue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {loading && (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skel-${i}`} className="animate-pulse">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <span className="h-7 w-7 rounded-lg bg-slate-200 dark:bg-white/10" />
                          <span className="h-3 w-24 rounded bg-slate-200 dark:bg-white/10" />
                        </div>
                      </td>
                      <td className="py-3"><span className="mx-auto block h-3 w-6 rounded bg-slate-200 dark:bg-white/10" /></td>
                      <td className="py-3"><span className="mx-auto block h-3 w-14 rounded bg-slate-200 dark:bg-white/10" /></td>
                      <td className="py-3"><span className="mx-auto block h-3 w-16 rounded bg-slate-200 dark:bg-white/10" /></td>
                    </tr>
                  ))
                )}
                {!loading && topRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-slate-400 dark:text-white/40">
                      Aucune donnée disponible.
                    </td>
                  </tr>
                )}
                {!loading && topRows.map((s) => (
                  <tr key={s.shop} className="hover:bg-slate-50 transition dark:hover:bg-white/[0.02]">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white ${s.rankBg}`}>
                          {s.rank}
                        </span>
                        {s.logo ? (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1 ring-1 ring-slate-200 dark:ring-white/10">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={s.logo} alt={s.displayName} className="h-full w-full object-contain" />
                          </span>
                        ) : (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-xs font-black text-slate-600 dark:bg-white/10 dark:text-white/60">
                            {s.displayName.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <div className="leading-tight">
                          <div className="font-semibold text-slate-900 dark:text-white">{s.displayName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center font-semibold tabular-nums text-slate-900 dark:text-white">{s.cheapestStr} produits</td>
                    <td className="py-3 text-center font-semibold tabular-nums text-slate-900 dark:text-white">{fmtPrice(s.avgPrice)}</td>
                    <td className="py-3 text-center font-bold tabular-nums text-slate-900 dark:text-white">{s.catalogStr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom button */}
          <div className="mt-4 flex justify-center">
            <Link
              href="/barometres/parapharmacie"
              className="rounded-full border border-brand-gold/60 px-8 py-2.5 text-sm font-semibold text-brand-gold hover:bg-brand-gold/10 transition"
            >
              Voir le classement complet
            </Link>
          </div>
        </div>

        {/* MEILLEURES OFFRES — ÉCRAN SOLAIRE */}
        <div className="card card-pad relative overflow-hidden flex flex-col">
          {/* watermark sun */}
          <Sun
            className="pointer-events-none absolute -right-4 -top-4 h-32 w-32 text-white/[0.04]"
            strokeWidth={1.2}
            aria-hidden
          />

          {/* Title */}
          <div className="relative mb-1 flex items-start gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/30 to-orange-500/10 ring-1 ring-amber-400/30">
              <Sun className="h-4.5 w-4.5 text-amber-300" strokeWidth={2.2} />
            </span>
            <div className="leading-tight flex-1">
              <div className="text-base font-black tracking-tight text-brand-gold">
                Où acheter ton écran solaire au meilleur prix ?
              </div>
              <div className="font-arabic text-xs font-semibold text-brand-gold/70 mt-0.5" dir="rtl">
                أين تشتري واقي الشمس بأفضل سعر؟
              </div>
            </div>
          </div>

          {/* Product hero */}
          <div className="relative mt-4 flex items-center gap-3 rounded-xl border border-amber-400/20 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent p-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white shadow-md ring-1 ring-amber-300/40">
              <img
                src={sunscreen?.product.image ?? "https://www.maparatunisie.tn/wp-content/uploads/2021/02/avene-creme-solaire-peaux-sensibles-spf-50-avene-solaires9-1716474405.jpg.webp"}
                alt="Avène SPF 50+"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {sunscreen?.product.label ?? "AVÈNE Soin Solaire SPF 50+"}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-white/55">
                {sunscreen?.product.subtitle ?? "Crème peaux sensibles sèches · 50ml"}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px]">
                <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 font-bold text-emerald-600 dark:text-emerald-300">En stock</span>
                <span className="text-slate-300 dark:text-white/40">·</span>
                <span className="text-slate-500 dark:text-white/60">
                  {sunscreenLoading
                    ? "…"
                    : `${sunscreen?.shopsTracked ?? 3} parapharmacie${(sunscreen?.shopsTracked ?? 3) > 1 ? "s" : ""} suivie${(sunscreen?.shopsTracked ?? 3) > 1 ? "s" : ""}`}
                </span>
              </div>
            </div>
          </div>

          {/* Offers list — prices from latest scrapes */}
          <ul className="relative mt-3 flex-1 space-y-2">
            {sunscreenLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <li key={`sun-skel-${i}`} className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-white/[0.05] dark:bg-bg-800">
                  <div className="h-8 rounded bg-slate-200 dark:bg-white/10" />
                </li>
              ))}
            {!sunscreenLoading && (sunscreen?.offers ?? []).length === 0 && (
              <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-400 dark:border-white/[0.05] dark:bg-bg-800 dark:text-white/40">
                Aucune offre en stock pour ce produit.
              </li>
            )}
            {!sunscreenLoading && (sunscreen?.offers ?? []).map((o) => {
              const best = o.rank === 1;
              const maxPrice = Math.max(...(sunscreen?.offers ?? []).map((x) => x.price));
              const deltaPct = Math.round(((o.price - maxPrice) / maxPrice) * 100);
              const deltaStr = deltaPct === 0 ? "prix référence" : `${deltaPct}% vs + cher`;
              const deltaColor = deltaPct < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-white/40";
              const rankCls = o.rank === 1
                ? "bg-gradient-to-br from-yellow-300 to-amber-600 text-yellow-950 ring-1 ring-yellow-200/50 shadow-md"
                : o.rank === 2 ? "bg-gradient-to-br from-slate-200 to-slate-500 text-slate-950 ring-1 ring-slate-200/40 shadow-md"
                : o.rank === 3 ? "bg-gradient-to-br from-amber-500 to-orange-700 text-amber-50 ring-1 ring-orange-300/40 shadow-md"
                : "border border-slate-300 text-slate-500 dark:border-white/10 dark:text-white/55";
              return (
                <li
                  key={o.name}
                  className={`grid grid-cols-[24px_1fr_auto_auto] items-center gap-2.5 rounded-xl border px-2.5 py-2 transition ${
                    best
                      ? "border-brand-gold/40 bg-gradient-to-r from-brand-gold/15 via-brand-gold/5 to-transparent shadow-[0_0_18px_-8px_rgba(246,196,83,0.55)]"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-white/[0.05] dark:bg-bg-800 dark:hover:border-white/15"
                  }`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black tabular-nums ${rankCls}`}>
                    {o.rank}
                  </span>
                  <div className="min-w-0 leading-tight">
                    <div className={`truncate text-sm font-semibold ${best ? "text-brand-gold" : "text-slate-800 dark:text-white/90"}`}>{o.name}</div>
                    <div className={`text-[10px] font-semibold tabular-nums ${deltaColor}`}>{deltaStr}</div>
                  </div>
                  <div className="text-right leading-tight">
                    <div className={`text-sm font-bold tabular-nums ${best ? "text-brand-gold" : "text-slate-900 dark:text-white"}`}>
                      {fmtPrice(o.price)}
                    </div>
                    {o.regular != null && (
                      <div className="text-[10px] tabular-nums text-slate-400 line-through">{fmtPrice(o.regular)}</div>
                    )}
                  </div>
                  <a
                    href={o.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`shrink-0 rounded-lg px-3 py-1 text-xs font-black transition ${
                      best
                        ? "bg-brand-gold text-black hover:bg-brand-gold/90"
                        : "border border-slate-300 text-slate-700 hover:border-brand-gold/40 hover:bg-brand-gold/10 hover:text-brand-gold dark:border-white/15 dark:text-white/80"
                    }`}
                  >
                    Voir
                  </a>
                </li>
              );
            })}
          </ul>

          {/* Savings footer */}
          {(sunscreen?.maxSavings ?? 0) > 0 && sunscreen?.leaderShop && (
            <div className="relative mt-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-white/75">
                <Sparkles className="h-3 w-3 text-emerald-500 dark:text-emerald-300" />
                Économie max en choisissant {sunscreen.leaderShop}
              </div>
              <div className="text-sm font-extrabold tabular-nums text-emerald-600 dark:text-emerald-300">
                −{fmtPrice(sunscreen.maxSavings)}
              </div>
            </div>
          )}

          {/* Bottom button */}
          <div className="mt-3 flex justify-center">
            <Link
              href="/parapharmacie"
              className="rounded-full border border-brand-gold/60 px-8 py-2 text-sm font-semibold text-brand-gold hover:bg-brand-gold/10 transition"
            >
              Voir toutes les offres
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

