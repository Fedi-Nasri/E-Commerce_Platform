import Link from "next/link";
import { ArrowRight, Medal } from "lucide-react";
import { ShopLogo } from "@/components/shop/ShopLogo";
import {
  formatEcartPct,
  shopDisplayName,
  type PriceRankingCatalogEntry,
} from "@/lib/priceRankings";

export type RankingShopPreview = {
  rank: number;
  shop_key: string;
  fair_win_rate: number;
  products_compared: number;
  ecart_pct?: number;
  featured_rank?: number;
};

const MEDAL = {
  1: {
    name: "Or",
    row:
      "border-brand-gold/35 bg-gradient-to-r from-amber-50/90 via-brand-gold/12 to-amber-50/40 dark:border-brand-gold/30 dark:from-brand-gold/14 dark:via-brand-gold/8 dark:to-transparent",
    badge:
      "bg-gradient-to-br from-[#f6d365] via-brand-gold to-[#d4a23a] text-slate-900 shadow-[0_2px_10px_rgba(246,196,83,0.45)] ring-1 ring-brand-gold/40",
    rate: "text-amber-800 dark:text-brand-gold",
  },
  2: {
    name: "Argent",
    row:
      "border-slate-300/70 bg-gradient-to-r from-slate-100 via-white to-slate-50 dark:border-white/12 dark:from-white/[0.09] dark:via-white/[0.05] dark:to-transparent",
    badge:
      "bg-gradient-to-br from-[#e8e8e8] via-[#c0c0c0] to-[#9ca3af] text-slate-800 shadow-sm ring-1 ring-white/50 dark:from-[#d1d5db] dark:via-[#9ca3af] dark:to-[#6b7280] dark:text-slate-950 dark:ring-white/20",
    rate: "text-slate-600 dark:text-white/75",
  },
  3: {
    name: "Bronze",
    row:
      "border-amber-800/20 bg-gradient-to-r from-orange-50/80 via-amber-50/40 to-orange-50/20 dark:border-amber-700/25 dark:from-amber-950/50 dark:via-amber-900/20 dark:to-transparent",
    badge:
      "bg-gradient-to-br from-[#e8a86b] via-[#cd7f32] to-[#9a5c22] text-white shadow-sm ring-1 ring-amber-900/20",
    rate: "text-amber-900 dark:text-amber-300",
  },
} as const;

function medalStyle(rank: number) {
  if (rank === 1) return MEDAL[1];
  if (rank === 2) return MEDAL[2];
  return MEDAL[3];
}

export function PriceRankingCard({
  catalog,
  matchedProducts,
  shopCount,
  shops,
}: {
  catalog: PriceRankingCatalogEntry;
  scopeName: string;
  matchedProducts: number;
  shopCount: number;
  shops: RankingShopPreview[];
}) {
  const top3 = [...shops.slice(0, 3)].sort(
    (a, b) => (a.featured_rank ?? a.rank) - (b.featured_rank ?? b.rank),
  );

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-bg-border bg-bg-card shadow-sm transition hover:border-brand-gold/30 hover:shadow-md dark:shadow-none dark:hover:border-brand-gold/25">
      {/* Category hero */}
      <div className="relative aspect-[16/10] shrink-0 overflow-hidden bg-slate-100 dark:bg-bg-900">
        <img
          src={catalog.image}
          alt=""
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/45 to-slate-950/10" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
            {catalog.subtitle}
          </p>
          <h3 className="mt-1 text-lg font-black leading-tight tracking-tight text-white sm:text-xl">
            {catalog.title}
          </h3>
          <p className="mt-1.5 text-[11px] text-white/55">
            {matchedProducts.toLocaleString("fr-FR")} produits · {shopCount} enseignes
          </p>
        </div>
      </div>

      {/* Vertical medal ranking */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/40">
          Top 3 enseignes
        </p>

        {top3.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400 dark:text-white/40">
            Données indisponibles
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {top3.map((shop) => {
              const medal = medalStyle(shop.rank);
              return (
                <li
                  key={shop.shop_key}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${medal.row}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black tabular-nums ${medal.badge}`}
                    title={medal.name}
                  >
                    {shop.rank === 1 ? (
                      <Medal className="h-4 w-4" strokeWidth={2.25} />
                    ) : (
                      shop.rank
                    )}
                  </span>

                  <ShopLogo shopKey={shop.shop_key} size={32} className="shrink-0" />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-slate-900 dark:text-white">
                      {shopDisplayName(shop.shop_key)}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-white/45">
                      {shop.products_compared} produits comparés
                    </p>
                  </div>

                  <span
                    className={`shrink-0 text-sm font-black tabular-nums ${medal.rate}`}
                  >
                    {shop.ecart_pct != null
                      ? formatEcartPct(shop.ecart_pct)
                      : `${Math.round(shop.fair_win_rate * 1000) / 10}%`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* CTA */}
      <div className="mt-auto border-t border-bg-border p-4 dark:border-white/[0.06]">
        <Link
          href={`/classement/${catalog.slug}`}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-bg-border bg-slate-50 px-4 py-2.5 text-[12px] font-semibold text-slate-800 transition hover:border-brand-gold/40 hover:bg-white hover:text-brand-gold dark:border-white/10 dark:bg-white/[0.03] dark:text-white/85 dark:hover:border-brand-gold/30 dark:hover:bg-white/[0.06]"
        >
          Classement complet & méthodologie
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </Link>
      </div>
    </article>
  );
}
