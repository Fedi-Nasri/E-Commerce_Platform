import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Info,
  ShieldCheck,
  Store,
  Trophy,
} from "lucide-react";
import { PriceRankingCharts } from "@/components/PriceRankingCharts";
import { ShopLogo } from "@/components/shop/ShopLogo";
import {
  confidenceLabel,
  fiabiliteLabel,
  formatEcartPct,
  formatRobustIndex,
  formatWinRate,
  shopDisplayName,
  statutLabel,
  statutTone,
  type PriceRankingCatalogEntry,
} from "@/lib/priceRankings";
import { featuredShops, type RankedShopRow, type ScopeRanking } from "@/lib/priceRankingsServer";

function fmtDate(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

const statCardClass =
  "rounded-xl border border-bg-border bg-bg-card p-4 shadow-sm dark:shadow-none";

function statutBadgeClass(tone: string) {
  if (tone === "cheap") return "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  if (tone === "expensive") return "bg-rose-500/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
  if (tone === "low") return "bg-slate-500/10 text-slate-600 dark:bg-white/10 dark:text-white/55";
  return "bg-amber-500/10 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200";
}

export function PriceRankingDetail({
  catalog,
  scope,
}: {
  catalog: PriceRankingCatalogEntry;
  scope: ScopeRanking;
}) {
  const updated = fmtDate(scope.generated_at);
  const isRobust = scope.method?.includes("robust") ?? false;
  const podiumShops = featuredShops(scope);
  const maxEcart = Math.max(
    ...podiumShops.map((s) => Math.abs(Number(s.ecart_pct ?? s.avg_extra_cost_vs_cheapest ?? 0))),
    0.1,
  );
  const podium = [...podiumShops].sort((a, b) => (b.featured_rank ?? b.rank) - (a.featured_rank ?? a.rank));

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-bg-border dark:border-white/[0.10]">
        <div className="relative aspect-[21/9] min-h-[160px] sm:min-h-[200px]">
          <img
            src={catalog.image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/80 to-slate-950/50 dark:from-[#060912]/98 dark:via-[#0a0e1a]/88 dark:to-[#0a0e1a]/55" />
          <div className="relative flex h-full flex-col justify-end p-5 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
              Classement prix · {scope.scope_name}
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
              {catalog.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/70">{catalog.subtitle}</p>
            {updated && (
              <p className="mt-3 text-[11px] text-white/45">Dernière analyse · {updated}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: BarChart3, label: "Produits comparés", value: scope.matched_products?.toLocaleString("fr-FR") ?? "—" },
          { icon: Store, label: "Enseignes", value: String(scope.distinct_shops ?? "—") },
          { icon: ShieldCheck, label: "Méthode", value: isRobust ? "Indice shrinkage" : "Tête-à-tête" },
          { icon: Info, label: "Classement", value: `Top ${scope.shops.length}` },
        ].map((s) => (
          <div key={s.label} className={statCardClass}>
            <s.icon className="mb-2 h-4 w-4 text-brand-gold" />
            <div className="text-xl font-black tabular-nums text-slate-900 dark:text-white">
              {s.value}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-white/50">{s.label}</div>
          </div>
        ))}
      </div>

      {podiumShops.length > 0 && (
        <div className={`${statCardClass} rounded-2xl p-5`}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">
            Podium · grandes enseignes fiables
          </h2>
          <div className="mt-4 flex items-end justify-center gap-3 sm:gap-6">
            {podium.map((shop) => {
              const ecart = Number(shop.ecart_pct ?? shop.avg_extra_cost_vs_cheapest ?? 0);
              const ratio = Math.abs(ecart) / maxEcart;
              const h = Math.round(36 + ratio * 56);
              const displayRank = shop.featured_rank ?? shop.rank;
              const isFirst = displayRank === 1;
              return (
                <div key={shop.shop_key} className="group/shop flex max-w-[140px] flex-1 flex-col items-center gap-2">
                  <ShopLogo
                    shopKey={shop.shop_key}
                    size={isFirst ? 58 : 48}
                    interactive
                    className={isFirst ? "ring-2 ring-brand-gold/40" : "ring-1 ring-white/10"}
                  />
                  <span className="w-full truncate text-center text-xs font-bold text-slate-800 dark:text-white">
                    {shopDisplayName(shop.shop_key)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-sm font-black tabular-nums ${
                      ecart <= 0
                        ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-rose-500/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                    }`}
                  >
                    {formatEcartPct(ecart)}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-white/40">
                    indice {formatRobustIndex(shop.robust_index)}
                  </span>
                  <div
                    className={`flex w-full items-end justify-center overflow-hidden rounded-t-lg ${
                      isFirst
                        ? "bg-gradient-to-t from-amber-500 to-brand-gold shadow-[0_-4px_16px_rgba(246,196,83,0.35)] ring-1 ring-brand-gold/30"
                        : "bg-gradient-to-t from-slate-500 to-slate-400 shadow-inner dark:from-slate-600 dark:to-slate-500"
                    }`}
                    style={{ height: h }}
                  >
                    <div className="flex items-center justify-center pb-1.5">
                      {isFirst ? (
                        <Trophy
                          className="h-5 w-5 text-slate-900 sm:h-6 sm:w-6"
                          strokeWidth={2.25}
                          fill="currentColor"
                          fillOpacity={0.15}
                        />
                      ) : (
                        <span className="pb-0 text-sm font-black text-white sm:text-base">{displayRank}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <PriceRankingCharts shops={scope.shops} paliers={scope.paliers} />

      <div className="rounded-2xl border border-bg-border bg-gradient-to-br from-slate-50 via-white to-slate-100/80 p-5 sm:p-6 dark:border-white/[0.08] dark:from-bg-800 dark:via-bg-800 dark:to-bg-900">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
          <Info className="h-4 w-4 text-brand-gold" />
          Comment lire ce classement
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-white/70">
          Nous comparons les <strong className="font-semibold text-slate-800 dark:text-white/90">mêmes produits identifiés</strong> entre
          boutiques tunisiennes, <strong className="font-semibold text-slate-800 dark:text-white/90">en stock confirmé</strong>. Le score
          principal est un <strong className="font-semibold text-slate-800 dark:text-white/90">indice prix shrinkage</strong> : plus il est bas,
          plus l&apos;enseigne est compétitive sur son catalogue comparé.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            {
              title: "Indice log-prix",
              body: "Chaque prix est rapporté à la médiane du cluster (ln(prix/médiane)). La moyenne par enseigne donne l'écart structurel vs le marché.",
            },
            {
              title: "Shrinkage bayésien",
              body: "Score ajusté = indice brut × n/(n+15). Les petits catalogues sont tirés vers la neutralité pour éviter les faux champions.",
            },
            {
              title: "Écart % vs marché",
              body: "Dérivé de l'indice ajusté : négatif = moins cher que la médiane du marché sur les produits comparés.",
            },
            {
              title: "Fiabilité & statut",
              body: "Test binomial + volume : MOINS CHER (fort), NEUTRE, PLUS CHER… Le podium met en avant les enseignes à large catalogue fiable.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-bg-border bg-bg-card p-4 dark:border-white/[0.06]"
            >
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-white/60">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-bg-border dark:border-white/[0.08]">
        <div className="border-b border-bg-border bg-bg-card px-5 py-4 dark:border-white/[0.06]">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            Classement complet
          </h2>
        </div>
        <div className="overflow-x-auto bg-bg-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-bg-border bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-white/45">
                <th className="px-5 py-3">Rang</th>
                <th className="px-3 py-3">Enseigne</th>
                <th className="px-3 py-3">Écart marché</th>
                <th className="hidden px-3 py-3 sm:table-cell">Indice</th>
                <th className="hidden px-3 py-3 md:table-cell">Win-rate</th>
                <th className="hidden px-3 py-3 sm:table-cell">Produits</th>
                <th className="px-5 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {scope.shops.map((row: RankedShopRow) => {
                const isLeader = row.rank === 1;
                const ecart = row.ecart_pct ?? row.avg_extra_cost_vs_cheapest;
                const tone = statutTone(row.statut);
                return (
                  <tr
                    key={row.shop_key}
                    className={`border-b border-bg-border transition hover:bg-slate-50/80 dark:border-white/[0.04] dark:hover:bg-white/[0.04] ${
                      isLeader ? "bg-brand-gold/[0.06] dark:bg-brand-gold/[0.10]" : ""
                    }`}
                  >
                    <td className="px-5 py-3.5 font-black tabular-nums text-slate-700 dark:text-white/85">
                      {row.rank}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-3">
                        <ShopLogo shopKey={row.shop_key} size={36} />
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {shopDisplayName(row.shop_key)}
                          </span>
                          <div className="text-[10px] text-slate-400 dark:text-white/40">
                            {fiabiliteLabel(row.fiabilite)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span
                        className={`text-base font-black tabular-nums ${
                          (ecart ?? 0) <= 0
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {formatEcartPct(ecart)}
                      </span>
                    </td>
                    <td className="hidden px-3 py-3.5 tabular-nums text-slate-600 dark:text-white/65 sm:table-cell">
                      {formatRobustIndex(row.robust_index)}
                    </td>
                    <td className="hidden px-3 py-3.5 tabular-nums text-slate-600 dark:text-white/65 md:table-cell">
                      {row.win_rate_pct != null ? formatWinRate(row.win_rate_pct / 100) : formatWinRate(row.fair_win_rate)}
                    </td>
                    <td className="hidden px-3 py-3.5 tabular-nums text-slate-600 dark:text-white/65 sm:table-cell">
                      {row.products_compared}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold ${statutBadgeClass(tone)}`}>
                        {statutLabel(row.statut) || confidenceLabel(row.confidence)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/retail?cat=${encodeURIComponent(catalog.retailCat)}`}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-brand-gold dark:text-slate-950 dark:hover:bg-brand-gold/90"
        >
          <Store className="h-4 w-4" />
          Parcourir les produits
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg border border-bg-border bg-bg-card px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-gold/35 hover:text-brand-gold dark:border-white/10 dark:text-white/85 dark:hover:border-brand-gold/30"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
