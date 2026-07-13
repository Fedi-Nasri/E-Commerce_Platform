import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, ChevronRight, Medal, Snowflake, Store, Tag, Thermometer, Wind,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/site/Reveal";
import { ShopLogo } from "@/components/shop/ShopLogo";
import { ClimBrandBadge } from "@/components/ClimBrandBadge";
import { climBrandHref } from "@/lib/climBrandUtils";
import { getClimStatsAsync } from "@/lib/climStats";

export const metadata = {
  title: "Climatiseurs en stock en Tunisie — prix et disponibilité | 1111.tn",
  description:
    "Disponibilité en temps réel des climatiseurs chez les enseignes tunisiennes : prix minimum par capacité BTU, marques en stock et meilleures offres.",
};

const fmt = (n: number) => n.toLocaleString("fr-FR");

const MEDAL_BADGE = [
  "bg-gradient-to-br from-[#f6d365] via-brand-gold to-[#d4a23a] text-slate-900 ring-1 ring-brand-gold/40",
  "bg-gradient-to-br from-[#e8e8e8] via-[#c0c0c0] to-[#9ca3af] text-slate-800 ring-1 ring-white/50 dark:from-[#d1d5db] dark:via-[#9ca3af] dark:to-[#6b7280] dark:text-slate-950",
  "bg-gradient-to-br from-[#e8a86b] via-[#cd7f32] to-[#9a5c22] text-white ring-1 ring-amber-900/20",
];

function rankBadgeClass(i: number) {
  return MEDAL_BADGE[i] ?? "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/60";
}

function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) +
    " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default async function ClimatiseursStockPage() {
  const clim = await getClimStatsAsync();
  const cheapest = clim.cheapestOffers(12);
  const btuLabels: Record<string, string> = {
    "9000": "Petites pièces · ~15 m²",
    "12000": "Chambres · ~20 m²",
    "18000": "Salons · ~30 m²",
    "24000": "Grands espaces · ~40 m²",
  };

  return (
    <main className="min-h-screen bg-white dark:bg-[#0a0e1a]">
      <Header />

      {/* ── Breadcrumb ── */}
      <div className="mx-auto max-w-[1600px] px-4 pt-5">
        <nav className="mb-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/40">
          <Link href="/" className="transition hover:text-brand-gold">Accueil</Link>
          <ChevronRight className="h-3 w-3 opacity-60" />
          <span className="text-brand-gold">Climatiseurs en stock</span>
        </nav>

        {/* ── Hero ── */}
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-blue-50/40 p-6 sm:p-9 dark:border-white/[0.07] dark:from-[#0c1626] dark:via-[#0d1220] dark:to-[#0a0e1a]">
            <div className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full bg-sky-400/15 blur-3xl" />
            <div className="pointer-events-none absolute -right-10 bottom-0 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-5">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 -z-10 rounded-2xl bg-sky-400/25 blur-2xl" />
                  <img
                    src="/clim.png"
                    alt="Climatiseur"
                    className="h-20 w-20 rounded-2xl object-contain ring-1 ring-sky-400/30 animate-[float_3s_ease-in-out_infinite] bg-white/60 p-2 dark:bg-white/10"
                  />
                </div>
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">
                    Climatiseurs <span className="gradient-text-gold">en stock</span>
                  </h1>
                  <p className="mt-1 font-arabic text-sm text-slate-500 dark:text-white/50" dir="rtl">
                    مكيفات الهواء المتوفرة — قارن الأسعار حسب القدرة
                  </p>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-white/65">
                    Disponibilité réelle relevée chez les enseignes tunisiennes :
                    <span className="font-bold text-slate-900 dark:text-white"> uniquement les modèles en stock</span>,
                    comparés par capacité BTU, marque et prix.
                  </p>
                  <p className="mt-2 text-[11px] text-slate-400 dark:text-white/35">
                    Données relevées le {formatGeneratedAt(clim.generatedAt)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                {[
                  { icon: Snowflake, label: "En stock", value: fmt(clim.totals.climatiseurs), cls: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300" },
                  { icon: Store, label: "Enseignes", value: String(clim.totals.boutiques), cls: "border-brand-gold/25 bg-brand-gold/10 text-brand-gold" },
                  { icon: Tag, label: "Marques", value: String(clim.totals.marques), cls: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" },
                ].map((c) => (
                  <div key={c.label} className={`rounded-2xl border px-5 py-3 text-center ${c.cls}`}>
                    <c.icon className="mx-auto h-4 w-4 opacity-80" />
                    <div className="mt-1 text-2xl font-black tabular-nums leading-none">{c.value}</div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider opacity-80">{c.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* ── Comparatif par capacité (BTU) ── */}
      <section className="mx-auto mt-12 max-w-[1600px] px-4">
        <Reveal>
          <div className="mb-5 flex items-center gap-3">
            <Wind className="h-5 w-5 text-brand-gold" />
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              Meilleur prix par <span className="gradient-text-gold">capacité</span>
            </h2>
          </div>
        </Reveal>
        <div className="grid gap-5 lg:grid-cols-3">
          {clim.btuTiers.map((btu, ti) => {
            const rows = clim.btuComparisonWithUrls(btu);
            return (
              <Reveal key={btu} delay={ti * 0.05}>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/[0.07] dark:bg-[#0d1220]">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/[0.06]">
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white">{fmt(Number(btu))} BTU</h3>
                      <p className="text-[11px] text-slate-400 dark:text-white/40">{btuLabels[btu] ?? ""}</p>
                    </div>
                    <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 text-[10px] font-bold tabular-nums text-sky-600 dark:text-sky-300">
                      {rows.reduce((a, r) => a + r.nb_annonces, 0)} offres
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                    {rows.slice(0, 8).map((r, i) => {
                      const inner = (
                        <>
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black tabular-nums ${rankBadgeClass(i)}`}>
                            {i === 0 ? <Medal className="h-3.5 w-3.5" strokeWidth={2.25} /> : i + 1}
                          </span>
                          <ShopLogo shopKey={r.shop} size={30} className="shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12.5px] font-bold text-slate-900 dark:text-white">
                              {clim.shopName(r.shop)}
                            </p>
                            <p className="truncate text-[10px] text-slate-400 dark:text-white/40">
                              <span className="capitalize">{r.marques_au_prix_min.slice(0, 2).join(", ")}</span>
                              {" · "}{r.nb_annonces} modèle{r.nb_annonces > 1 ? "s" : ""} · moy. {fmt(Math.round(r.prix_moyen))} DT
                            </p>
                          </div>
                          <span className={`shrink-0 text-[13px] font-black tabular-nums ${i === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-white/80"}`}>
                            {fmt(r.prix_min)} <span className="text-[10px] font-bold">DT</span>
                          </span>
                          {r.url && (
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:text-brand-gold dark:text-white/25" />
                          )}
                        </>
                      );

                      return (
                        <li key={r.shop}>
                          {r.url ? (
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={r.title ?? undefined}
                              className="group flex items-center gap-3 px-4 py-2.5 transition hover:bg-sky-50/80 dark:hover:bg-sky-950/20"
                            >
                              {inner}
                            </a>
                          ) : (
                            <div className="flex items-center gap-3 px-4 py-2.5">{inner}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── Top offres les moins chères ── */}
      <section className="mx-auto mt-14 max-w-[1600px] px-4">
        <Reveal>
          <div className="mb-5 flex items-center gap-3">
            <Thermometer className="h-5 w-5 text-brand-gold" />
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              Top offres <span className="gradient-text-gold">les moins chères</span>
            </h2>
          </div>
        </Reveal>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/[0.07] dark:bg-[#0d1220]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]">
                <tr>
                  {["#", "Enseigne", "Climatiseur", "Marque", "BTU", "Technologie", "Prix"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cheapest.map((o, i) => (
                  <tr key={`${o.shop}-${i}`} className={`border-t border-slate-100 transition hover:bg-slate-50 dark:border-white/[0.05] dark:hover:bg-white/[0.02] ${i % 2 ? "bg-slate-50/40 dark:bg-white/[0.012]" : ""}`}>
                    <td className="px-4 py-2.5">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black tabular-nums ${rankBadgeClass(i)}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <ShopLogo shopKey={o.shop} size={26} className="shrink-0" />
                        <span className="whitespace-nowrap text-[12px] font-bold text-slate-800 dark:text-white/85">{clim.shopName(o.shop)}</span>
                      </div>
                    </td>
                    <td className="max-w-[360px] px-4 py-2.5">
                      <a href={o.url} target="_blank" rel="noopener noreferrer" className="group inline-flex items-start gap-1 text-[12px] font-medium text-slate-700 transition hover:text-brand-gold dark:text-white/75">
                        <span className="line-clamp-2">{o.title}</span>
                        <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100" />
                      </a>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] font-semibold capitalize text-slate-600 dark:text-white/60">{o.brand ?? "—"}</td>
                    <td className="px-4 py-2.5 text-[12px] tabular-nums text-slate-600 dark:text-white/60">{o.btu ? fmt(Number(o.btu)) : "—"}</td>
                    <td className="px-4 py-2.5">
                      {o.tech ? (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${/inverter/i.test(o.tech) ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-white/55"}`}>
                          {o.tech}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[14px] font-black tabular-nums text-brand-gold">{fmt(o.price)} DT</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Marques en stock ── */}
      <section className="mx-auto mt-14 max-w-[1600px] px-4">
        <Reveal>
          <div className="mb-5 flex items-center gap-3">
            <Tag className="h-5 w-5 text-brand-gold" />
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              Marques <span className="gradient-text-gold">disponibles</span>
            </h2>
            <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-300">
              {clim.totals.marques} marques
            </span>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {clim.brandTotals.map((b) => (
            <ClimBrandBadge
              key={b.brand}
              label={clim.brandLabel(b.brand)}
              logo={clim.brandLogo(b.brand)}
              count={b.count}
              href={climBrandHref(b.brand)}
            />
          ))}
        </div>
      </section>

      {/* ── Stock par enseigne ── */}
      <section className="mx-auto mt-14 max-w-[1600px] px-4 pb-16">
        <Reveal>
          <div className="mb-5 flex items-center gap-3">
            <Store className="h-5 w-5 text-brand-gold" />
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              Stock par <span className="gradient-text-gold">enseigne</span>
            </h2>
          </div>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clim.shops.map((shop, i) => {
            const topBrands = Object.entries(shop.marques).sort((a, b) => b[1] - a[1]).slice(0, 5);
            const btuEntries = Object.entries(shop.par_btu).sort((a, b) => Number(a[0]) - Number(b[0]));
            const btuMax = Math.max(1, ...btuEntries.map(([, n]) => n));
            const best = clim.shopCheapest(shop.shop);
            return (
              <Reveal key={shop.shop} delay={Math.min(i, 8) * 0.03}>
                <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.025]">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/[0.06]">
                    <div className="flex min-w-0 items-center gap-3">
                      <ShopLogo shopKey={shop.shop} size={38} className="shrink-0" />
                      <div className="min-w-0">
                        <div className="truncate font-bold text-slate-900 dark:text-white">{clim.shopName(shop.shop)}</div>
                        <div className="text-[10px] text-slate-400 dark:text-white/40">
                          relevé {shop.scrape.slice(0, 10)}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xl font-black tabular-nums text-slate-900 dark:text-white">{shop.total_climatiseurs}</div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-white/40">en stock</div>
                    </div>
                  </div>

                  {btuEntries.length > 0 && (
                    <div className="space-y-1.5 border-b border-slate-100 px-4 py-3 dark:border-white/[0.06]">
                      {btuEntries.map(([btu, n]) => (
                        <div key={btu} className="flex items-center gap-2">
                          <span className="w-14 shrink-0 text-[10px] font-bold tabular-nums text-slate-500 dark:text-white/50">
                            {fmt(Number(btu))}
                          </span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500"
                              style={{ width: `${Math.round((n / btuMax) * 100)}%` }}
                            />
                          </div>
                          <span className="w-6 shrink-0 text-right text-[10px] tabular-nums text-slate-400 dark:text-white/40">{n}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 px-4 py-3">
                    {topBrands.map(([brand, n]) => (
                      <span key={brand} className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold capitalize text-slate-600 dark:bg-white/[0.06] dark:text-white/60">
                        {brand} <span className="tabular-nums opacity-60">{n}</span>
                      </span>
                    ))}
                  </div>

                  {best && (
                    <div className="mt-auto border-t border-slate-100 px-4 py-3 dark:border-white/[0.06]">
                      <a
                        href={best.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            Moins cher · {best.btu ? `${fmt(Number(best.btu))} BTU` : ""}
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-600 transition group-hover:text-brand-gold dark:text-white/60">
                            {best.title}
                          </p>
                        </div>
                        <span className="flex shrink-0 items-center gap-1 text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                          {fmt(best.price)} DT
                          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                        </span>
                      </a>
                    </div>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      <Footer />
    </main>
  );
}
