"use client";
import { ChefHat, ChevronLeft, ChevronRight, Sparkles, Store } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  fmtDt,
  getEssentialBasketData,
  getQoffaBasketItems,
  shopDisplayName,
  type QoffaBasketItem,
} from "@/lib/essentialBasket";
import { PlateOrbit } from "./PlateOrbit";
import { getPopularPlatesData } from "@/lib/popularPlates";
import { PAGE_CONTAINER } from "@/components/site/PageContainer";

type LatestProduct = {
  id: number;
  name: string;
  slug: string;
  brand: string | null;
  category: string | null;
  catalog: "alimentation" | "para" | "retail";
  img: string | null;
  shop: string | null;
  price: number | null;
  createdAt: string;
};

const CATALOG_META: Record<LatestProduct["catalog"], { label: string; href: string; chip: string }> = {
  alimentation: { label: "Supermarché",   href: "/supermarche",    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" },
  para:         { label: "Parapharmacie", href: "/parapharmacie",  chip: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300" },
  retail:       { label: "Retail",        href: "/retail",         chip: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300" },
};

const qoffaBasketItems = getQoffaBasketItems();
const qoffaBasketMeta = getEssentialBasketData().fiveShop;
const popularPlates = getPopularPlatesData().strict;

function fmtRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "récemment";
  const diff = (Date.now() - t) / 1000;
  if (diff < 60)    return "à l'instant";
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  const d = Math.floor(diff / 86400);
  if (d < 7)        return `il y a ${d} j`;
  if (d < 30)       return `il y a ${Math.floor(d / 7)} sem.`;
  return `il y a ${Math.floor(d / 30)} mois`;
}

function fmtPrice(n: number | null): string {
  if (n == null) return "—";
  return `${n.toFixed(2).replace(/\.?0+$/, "").replace(".", ",")} DT`;
}

function LatestProductThumb({ src, name }: { src: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  const image = src?.trim();

  if (image && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        className="h-full w-full object-contain p-0.5 transition duration-500 group-hover/row:scale-110"
        loading="lazy"
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <span className="flex h-full w-full items-center justify-center text-base text-slate-300 dark:text-white/20">
      📦
    </span>
  );
}

// Shows one basket item at a time, auto-advancing every few seconds.
function PanierSlider({ items }: { items: QoffaBasketItem[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = items.length;

  const go = (next: number) => {
    if (count <= 0) return;
    setIndex(((next % count) + count) % count);
  };

  useEffect(() => {
    if (paused || count <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), 4000);
    return () => clearInterval(id);
  }, [paused, count]);

  const item = items[index];
  if (!item) return null;

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="flex items-stretch gap-1.5">
        <button
          type="button"
          aria-label="Précédent"
          onClick={() => go(index - 1)}
          className="flex w-6 shrink-0 items-center justify-center rounded-lg border border-slate-200/70 bg-white/60 text-slate-500 transition hover:border-brand-gold/40 hover:text-brand-gold dark:border-white/20 dark:bg-white/[0.10] dark:text-white/80"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div
            key={`${item.productId}-${index}`}
            className="panier-slide-card rounded-lg border border-slate-200/70 bg-white/80 px-3 py-2.5 dark:border-white/20 dark:bg-slate-800/90 dark:shadow-[0_10px_24px_-14px_rgba(0,0,0,0.85)]"
          >
            <div className="text-[10px] font-bold uppercase tracking-wide text-brand-gold">
              {item.category}
            </div>
            <div className="mt-1 flex min-w-0 items-start justify-between gap-2">
              <span className="line-clamp-2 text-[11px] font-extrabold leading-snug text-slate-900 dark:text-white">
                {item.name}
              </span>
              <span className="shrink-0 rounded-md border border-emerald-500/35 bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-black tabular-nums text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-200">
                {fmtDt(item.price)} DT
              </span>
            </div>
            <p className="mt-1 truncate text-[10px] text-slate-500 dark:text-white/70">{item.choice}</p>
            <p className="mt-0.5 line-clamp-2 text-[10px] font-semibold leading-snug text-slate-600 dark:text-white/85">
              {item.shop}
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Suivant"
          onClick={() => go(index + 1)}
          className="flex w-6 shrink-0 items-center justify-center rounded-lg border border-slate-200/70 bg-white/60 text-slate-500 transition hover:border-brand-gold/40 hover:text-brand-gold dark:border-white/20 dark:bg-white/[0.10] dark:text-white/80"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {count > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {items.map((it, i) => (
            <button
              type="button"
              key={it.productId}
              aria-label={`Produit ${i + 1}`}
              onClick={() => go(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-4 bg-brand-gold" : "w-1.5 bg-slate-300 dark:bg-white/20"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function QoffaSection({ contained = true }: { contained?: boolean }) {
  const [items, setItems] = useState<LatestProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | LatestProduct["catalog"]>("all");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/latest-products")
      .then(r => (r.ok ? r.json() : { items: [] }))
      .then(d => { if (!cancelled) setItems(Array.isArray(d?.items) ? d.items : []); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(() => ({
    all: items.length,
    alimentation: items.filter(i => i.catalog === "alimentation").length,
    para:         items.filter(i => i.catalog === "para").length,
    retail:       items.filter(i => i.catalog === "retail").length,
  }), [items]);

  const filtered = tab === "all" ? items : items.filter(i => i.catalog === tab);
  const outerClass = contained ? `${PAGE_CONTAINER} mt-5` : "min-w-0";
  return (
    <section className={outerClass}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1.5fr_1.2fr]">
        {/* QOFFA TOUNSI */}
        <div className="card card-pad relative overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛒</span>
            <span className="section-title text-brand-gold">QOFFA TOUNSI</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-white/60">Le coût réel de la vie en Tunisie</div>
          <div className="font-arabic text-[11px] text-slate-400 dark:text-white/40" dir="rtl">قفة التونسي</div>
          <div className="mt-4 flex justify-center">
            <img
              src="/couffin.png"
              alt="Couffin tunisien"
              className="h-40 w-40 md:h-48 md:w-48 animate-couffin-swing object-contain drop-shadow-[0_8px_20px_rgba(212,175,55,0.35)]"
            />
          </div>
          <Link href="/qoffa" className="btn-primary mt-3 w-full">Voir le panier Qoffa</Link>

          {/* Stat cards */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="flex flex-col justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-center">
              <div className="text-base font-extrabold tabular-nums text-emerald-600 dark:text-emerald-300">
                {fmtDt(qoffaBasketMeta.ranking[0]?.total ?? 0)} DT
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500 dark:text-white/60">
                Panier · {shopDisplayName(qoffaBasketMeta.ranking[0]?.shop ?? "")}
              </div>
            </div>
            <div className="flex flex-col justify-center rounded-lg border border-brand-gold/30 bg-brand-gold/10 p-3.5 text-center">
              <div className="text-base font-extrabold tabular-nums text-brand-gold">
                {qoffaBasketMeta.productCount}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500 dark:text-white/60">Produits comparés</div>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50/90 p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-brand-gold">
                Meilleur prix par produit
              </span>
              <Link href="/grande-distribution" className="text-[10px] font-semibold text-slate-500 transition hover:text-brand-gold dark:text-white/50">
                Détail →
              </Link>
            </div>
            <PanierSlider items={qoffaBasketItems} />
          </div>
        </div>

        {/* RECETTES POPULAIRES */}
        <div className="card card-pad relative overflow-visible">
          {/* Watermark icon */}
          <ChefHat
            className="pointer-events-none absolute -right-2 -top-2 h-28 w-28 text-white/[0.04]"
            strokeWidth={1.2}
            aria-hidden
          />

          {/* Header */}
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-gold/25 to-brand-gold/5 ring-1 ring-brand-gold/30">
                <ChefHat className="h-4 w-4 text-brand-gold" strokeWidth={2.2} />
              </span>
              <div className="leading-tight">
                <div className="section-title">Plats populaires</div>
                <div className="font-arabic text-[11px] text-slate-400 dark:text-white/40" dir="rtl">
                  أطباق شعبية
                </div>
              </div>
            </div>
            <span className="rounded-full border border-brand-gold/25 bg-brand-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-gold">
              Produits identiques
            </span>
          </div>

          <div className="relative mt-4 overflow-visible pb-3">
            <div className="mb-3 flex items-center justify-between text-[10px]">
              <span className="font-bold uppercase tracking-wider text-brand-gold">
                Décortiquez le plat
              </span>
              <span className="text-slate-400 dark:text-white/45">
                Ojja & makrouna · données croisées
              </span>
            </div>
            <PlateOrbit plates={popularPlates} />
          </div>

          <Link
            className="relative mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-gold transition hover:gap-2 hover:underline"
            href="/qoffa/plats"
          >
            Voir tous les plats →
          </Link>
        </div>

        {/* DERNIERS PRODUITS AJOUTÉS */}
        <div className="card card-pad relative overflow-hidden flex flex-col">
          <Sparkles
            className="pointer-events-none absolute -right-2 -top-2 h-28 w-28 text-white/[0.04]"
            strokeWidth={1.2}
            aria-hidden
          />

          {/* Header */}
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-gold/25 to-brand-gold/5 ring-1 ring-brand-gold/30">
                <Sparkles className="h-4 w-4 text-brand-gold" strokeWidth={2.2} />
              </span>
              <div className="leading-tight">
                <div className="section-title">Derniers ajouts</div>
                <div className="text-[11px] text-slate-500 dark:text-white/55">Par catégorie · par enseigne · temps réel</div>
              </div>
            </div>
            <span className="relative flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Live
            </span>
          </div>

          {/* Tab pills */}
          <div className="relative mt-3 flex flex-wrap gap-1.5">
            {([
              { id: "all" as const,           label: "Tout",         count: counts.all,          tone: "brand-gold" },
              { id: "alimentation" as const,  label: "Supermarché",  count: counts.alimentation, tone: "emerald" },
              { id: "para" as const,          label: "Para",         count: counts.para,         tone: "rose" },
              { id: "retail" as const,        label: "Retail",       count: counts.retail,       tone: "blue" },
            ]).map(t => {
              const active = tab === t.id;
              const activeCls =
                t.tone === "emerald" ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" :
                t.tone === "rose"    ? "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300" :
                t.tone === "blue"    ? "border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-300" :
                                       "border-brand-gold/40 bg-brand-gold/15 text-brand-gold";
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                    active
                      ? activeCls
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60"
                  }`}
                >
                  {t.label}
                  <span className={`tabular-nums ${active ? "" : "opacity-60"}`}>{t.count}</span>
                </button>
              );
            })}
          </div>

          {/* List */}
          <div className="relative mt-3 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]" style={{ maxHeight: 380 }}>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex animate-pulse items-center gap-2.5 rounded-lg border border-slate-100 p-2 dark:border-white/[0.05]">
                    <div className="h-12 w-12 shrink-0 rounded-md bg-slate-100 dark:bg-white/[0.06]" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-2/3 rounded bg-slate-100 dark:bg-white/[0.06]" />
                      <div className="h-2.5 w-1/2 rounded bg-slate-100 dark:bg-white/[0.06]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/55">
                Aucun produit récent disponible pour ce filtre.
              </div>
            ) : (
              <ul className="space-y-2">
                {filtered.slice(0, 12).map((p, i) => {
                  const meta = CATALOG_META[p.catalog];
                  const productHref =
                    p.catalog === "para"   ? `/parapharmacie/${p.slug}` :
                    p.catalog === "retail" ? `/retail/${p.slug}` :
                                             `/supermarche/${p.slug}`;
                  const fresh = i < 3 && tab === "all";
                  return (
                    <li key={`${p.catalog}-${p.id}`}>
                      <Link
                        href={productHref}
                        className="group/row flex items-center gap-2.5 rounded-lg border border-slate-100 p-2 transition hover:-translate-y-0.5 hover:border-brand-gold/30 hover:bg-brand-gold/[0.03] dark:border-white/[0.05] dark:hover:bg-white/[0.03]"
                      >
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200 dark:from-white/[0.05] dark:to-white/[0.02] dark:ring-white/10">
                          <LatestProductThumb src={p.img} name={p.name} />
                          {fresh && (
                            <span className="absolute -right-0.5 -top-0.5 rounded-full bg-brand-red px-1 text-[7px] font-black text-white shadow">
                              NEW
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {p.brand && (
                              <span className="truncate text-[10px] font-extrabold uppercase tracking-wider text-brand-gold">
                                {p.brand}
                              </span>
                            )}
                            <span className={`shrink-0 rounded-full border px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider ${meta.chip}`}>
                              {meta.label}
                            </span>
                          </div>
                          <div className="truncate text-[12px] font-bold text-slate-900 dark:text-white">
                            {p.name}
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px]">
                            <span className="truncate text-slate-500 dark:text-white/50">
                              {p.shop ?? "—"}
                              {p.category && <span className="text-slate-300 dark:text-white/30"> · {p.category}</span>}
                            </span>
                            <span className="shrink-0 font-bold tabular-nums text-brand-gold">
                              {fmtPrice(p.price)}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[9.5px] uppercase tracking-wider text-slate-400 dark:text-white/35">
                            {fmtRelative(p.createdAt)}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer CTA */}
          <div className="relative mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-white/[0.05]">
            <span className="text-[10px] text-slate-400 dark:text-white/40 inline-flex items-center gap-1">
              <Store className="h-3 w-3" />
              {tab === "all" ? `${counts.all} produits récents` : `${filtered.length} dans cette catégorie`}
            </span>
            <Link
              href={tab === "all" ? "/" : CATALOG_META[tab].href}
              className="text-[11px] font-bold text-brand-gold transition hover:underline"
            >
              Voir le catalogue →
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}
