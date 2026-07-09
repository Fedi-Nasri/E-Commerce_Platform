import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowRight,
  ChevronRight,
  Snowflake,
  Store,
  Tag,
  Wind,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/site/Reveal";
import { ClimBrandBtuCharts } from "@/components/ClimBrandBtuCharts";
import { ClimBrandProductList } from "@/components/ClimBrandProductList";
import { ShopLogo } from "@/components/shop/ShopLogo";
import {
  climBrandDetail,
  climBrandFromSlug,
  climBrandHref,
  climBrandSlugs,
  climGeneratedAt,
  climShopName,
  formatDT,
} from "@/lib/climStats";
import { pageMetadata } from "@/lib/seo";

const fmt = (n: number) => n.toLocaleString("fr-FR");

function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function generateStaticParams() {
  return climBrandSlugs.map((brand) => ({ brand }));
}

export async function generateMetadata({
  params,
}: {
  params: { brand: string };
}): Promise<Metadata> {
  const key = climBrandFromSlug(params.brand);
  if (!key) return { title: "Marque introuvable" };
  const detail = climBrandDetail(key);
  const label = detail?.label ?? key;
  return pageMetadata({
    title: `Climatiseurs ${label} en stock — prix Tunisie`,
    description: `${detail?.count ?? 0} climatiseurs ${label} disponibles chez ${detail?.shopCount ?? 0} enseignes en Tunisie. Comparez les prix par capacité BTU.`,
    path: climBrandHref(key),
  });
}

export default function ClimBrandPage({ params }: { params: { brand: string } }) {
  const brandKey = climBrandFromSlug(params.brand);
  if (!brandKey) notFound();

  const detail = climBrandDetail(brandKey);
  if (!detail) notFound();

  return (
    <main className="min-h-screen bg-white dark:bg-[#0a0e1a]">
      <Header />

      <div className="mx-auto max-w-[1600px] px-4 pt-5">
        <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/40">
          <Link href="/" className="transition hover:text-brand-gold">Accueil</Link>
          <ChevronRight className="h-3 w-3 opacity-60" />
          <Link href="/climatiseurs-stock" className="transition hover:text-brand-gold">Climatiseurs en stock</Link>
          <ChevronRight className="h-3 w-3 opacity-60" />
          <span className="text-brand-gold">{detail.label}</span>
        </nav>

        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-blue-50/40 p-6 sm:p-8 dark:border-white/[0.07] dark:from-[#0c1626] dark:via-[#0d1220] dark:to-[#0a0e1a]">
            <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-sky-400/15 blur-3xl" />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-5">
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
                  {detail.logo ? (
                    <img src={detail.logo} alt="" className="h-14 w-14 object-contain" />
                  ) : (
                    <span className="text-2xl font-black text-slate-500">{detail.label.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">
                    <Snowflake className="h-3 w-3" /> Marque · en stock
                  </p>
                  <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">
                    Climatiseurs <span className="gradient-text-gold">{detail.label}</span>
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-white/65">
                    <span className="font-bold text-slate-900 dark:text-white">{detail.count} modèles</span> en stock
                    chez <span className="font-bold text-slate-900 dark:text-white">{detail.shopCount} enseignes</span>
                    {detail.minPrice != null && (
                      <> — à partir de <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatDT(detail.minPrice)}</span></>
                    )}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-400 dark:text-white/35">
                    Données du {formatGeneratedAt(climGeneratedAt)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                {[
                  { icon: Tag, label: "Modèles", value: String(detail.count) },
                  { icon: Store, label: "Enseignes", value: String(detail.shopCount) },
                  { icon: Wind, label: "Capacités", value: String(detail.byBtu.length) },
                ].map((c) => (
                  <div key={c.label} className="rounded-2xl border border-sky-500/25 bg-sky-500/10 px-5 py-3 text-center text-sky-700 dark:text-sky-300">
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

      {detail.byBtu.length > 0 && (
        <section className="mx-auto mt-10 max-w-[1600px] px-4">
          <Reveal>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
              <Wind className="h-5 w-5 text-brand-gold" />
              Par capacité <span className="gradient-text-gold">BTU</span>
            </h2>
          </Reveal>
          <Reveal delay={0.05}>
            <ClimBrandBtuCharts byBtu={detail.byBtu} />
          </Reveal>
        </section>
      )}

      <section id="clim-brand-products" className="mx-auto mt-12 max-w-[1600px] px-4">
        <Reveal>
          <h2 className="mb-1 text-lg font-black text-slate-900 dark:text-white">
            Tous les climatiseurs <span className="gradient-text-gold">{detail.label}</span> en stock
          </h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-white/50">
            {detail.count} modèles — cliquez sur un produit pour ouvrir la fiche sur le site de l&apos;enseigne.
          </p>
        </Reveal>
        <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/[0.04]" />}>
          <ClimBrandProductList offers={detail.offers} />
        </Suspense>
      </section>

      <section className="mx-auto mt-12 max-w-[1600px] px-4 pb-16">
        <Reveal>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
            <Store className="h-5 w-5 text-brand-gold" />
            Enseignes proposant <span className="gradient-text-gold">{detail.label}</span>
          </h2>
        </Reveal>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {detail.byShop.map((row, i) => (
            <Reveal key={row.shop} delay={Math.min(i, 8) * 0.03}>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/[0.07] dark:bg-white/[0.025]">
                <div className="flex min-w-0 items-center gap-3">
                  <ShopLogo shopKey={row.shop} size={36} className="shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate font-bold text-slate-900 dark:text-white">{climShopName(row.shop)}</div>
                    <div className="text-[11px] text-slate-400 dark:text-white/40">
                      {row.count} modèle{row.count > 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Dès</div>
                  <div className="text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(row.minPrice)} DT</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-8">
          <Link
            href="/climatiseurs-stock"
            className="inline-flex items-center gap-2 rounded-xl border border-bg-border bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-brand-gold/40 hover:text-brand-gold dark:border-white/10 dark:bg-white/[0.03] dark:text-white/85"
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
            Retour au comparatif climatiseurs
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
