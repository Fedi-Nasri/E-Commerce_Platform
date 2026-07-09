"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { ShopLogo } from "@/components/shop/ShopLogo";
import { climShopName, type ClimOffer } from "@/lib/climStats";

const PAGE_SIZE = 10;
const fmt = (n: number) => n.toLocaleString("fr-FR");

function ProductCard({ offer, index }: { offer: ClimOffer; index: number }) {
  if (!offer.url) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 opacity-60 dark:border-white/[0.07] dark:bg-[#0d1220]">
        <p className="line-clamp-2 text-sm font-medium text-slate-700 dark:text-white/75">{offer.title}</p>
        <p className="mt-2 text-xs text-slate-400">Lien boutique indisponible</p>
      </div>
    );
  }

  return (
    <a
      href={offer.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-sky-400/50 hover:shadow-md hover:shadow-sky-500/10 dark:border-white/[0.07] dark:bg-[#0d1220] dark:hover:border-sky-400/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShopLogo shopKey={offer.shop} size={28} className="shrink-0" />
          <span className="text-[11px] font-bold text-slate-600 dark:text-white/65">
            {climShopName(offer.shop)}
          </span>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-500 dark:bg-white/[0.06] dark:text-white/45">
          #{index + 1}
        </span>
      </div>

      <h3 className="mt-3 line-clamp-3 flex-1 text-[13px] font-semibold leading-snug text-slate-800 transition group-hover:text-brand-gold dark:text-white/90">
        {offer.title}
      </h3>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {offer.btu && (
          <span className="rounded-md bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-sky-700 dark:text-sky-300">
            {fmt(Number(offer.btu))} BTU
          </span>
        )}
        {offer.tech && (
          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
              /inverter/i.test(offer.tech)
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-white/55"
            }`}
          >
            {offer.tech}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/[0.06]">
        <span className="text-lg font-black tabular-nums text-brand-gold">
          {fmt(offer.price)} <span className="text-xs font-bold">DT</span>
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 opacity-80 transition group-hover:opacity-100 dark:text-sky-400">
          Voir chez le vendeur
          <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </a>
  );
}

function ProductTableRow({ offer, index }: { offer: ClimOffer; index: number }) {
  const open = () => {
    if (offer.url) window.open(offer.url, "_blank", "noopener,noreferrer");
  };

  return (
    <tr
      onClick={open}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && offer.url) {
          e.preventDefault();
          open();
        }
      }}
      tabIndex={offer.url ? 0 : undefined}
      role={offer.url ? "link" : undefined}
      className={`group border-t border-slate-100 transition dark:border-white/[0.05] ${
        offer.url ? "cursor-pointer hover:bg-sky-50/80 dark:hover:bg-sky-950/20" : ""
      }`}
    >
      <td className="px-4 py-2.5 text-[11px] font-bold tabular-nums text-slate-400">{index + 1}</td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ShopLogo shopKey={offer.shop} size={26} className="shrink-0" />
          <span className="whitespace-nowrap text-[12px] font-bold text-slate-800 dark:text-white/85">
            {climShopName(offer.shop)}
          </span>
        </div>
      </td>
      <td className="max-w-[380px] px-4 py-2.5">
        <span className="line-clamp-2 text-[12px] font-medium text-slate-700 group-hover:text-brand-gold dark:text-white/75">
          {offer.title}
        </span>
      </td>
      <td className="px-4 py-2.5 text-[12px] tabular-nums text-slate-600 dark:text-white/60">
        {offer.btu ? fmt(Number(offer.btu)) : "—"}
      </td>
      <td className="px-4 py-2.5">
        {offer.tech ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              /inverter/i.test(offer.tech)
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                : "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-white/55"
            }`}
          >
            {offer.tech}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-2.5 text-[14px] font-black tabular-nums text-brand-gold">
        {fmt(offer.price)} DT
      </td>
      <td className="px-4 py-2.5">
        {offer.url ? (
          <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-brand-gold" />
        ) : null}
      </td>
    </tr>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <p className="text-[12px] text-slate-500 dark:text-white/45">
        Affichage <span className="font-bold text-slate-700 dark:text-white/75">{from}–{to}</span> sur{" "}
        <span className="font-bold text-slate-700 dark:text-white/75">{total}</span> produits
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-bg-border bg-bg-card text-slate-500 transition hover:border-brand-gold/50 hover:text-brand-gold disabled:cursor-not-allowed disabled:opacity-30 dark:text-white/60"
          aria-label="Page précédente"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPage(p)}
            className={`h-9 min-w-9 rounded-xl px-3 text-sm font-bold tabular-nums transition ${
              p === page
                ? "bg-brand-gold text-black shadow-sm"
                : "border border-bg-border bg-bg-card text-slate-500 hover:border-brand-gold/50 hover:text-brand-gold dark:text-white/60"
            }`}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-bg-border bg-bg-card text-slate-500 transition hover:border-brand-gold/50 hover:text-brand-gold disabled:cursor-not-allowed disabled:opacity-30 dark:text-white/60"
          aria-label="Page suivante"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ClimBrandProductList({ offers }: { offers: ClimOffer[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const totalPages = Math.max(1, Math.ceil(offers.length / PAGE_SIZE));

  const page = useMemo(() => {
    const raw = parseInt(searchParams.get("page") ?? "1", 10);
    const n = Number.isFinite(raw) && raw > 0 ? raw : 1;
    return Math.min(n, totalPages);
  }, [searchParams, totalPages]);

  useEffect(() => {
    const raw = parseInt(searchParams.get("page") ?? "1", 10);
    if (!Number.isFinite(raw) || raw < 1 || raw > totalPages) {
      const qs = page > 1 ? `?page=${page}` : "";
      router.replace(`${pathname}${qs}`, { scroll: false });
    }
  }, [searchParams, page, totalPages, pathname, router]);

  const start = (page - 1) * PAGE_SIZE;
  const pageOffers = offers.slice(start, start + PAGE_SIZE);

  const goToPage = (next: number) => {
    const p = Math.max(1, Math.min(totalPages, next));
    const qs = p > 1 ? `?page=${p}` : "";
    router.push(`${pathname}${qs}`, { scroll: false });
    document.getElementById("clim-brand-products")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:hidden">
        {pageOffers.map((o, i) => (
          <ProductCard key={`${o.shop}-${o.url}-${start + i}`} offer={o} index={start + i} />
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/[0.07] dark:bg-[#0d1220] xl:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]">
              <tr>
                {["#", "Enseigne", "Modèle", "BTU", "Technologie", "Prix", ""].map((h) => (
                  <th
                    key={h || "go"}
                    className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageOffers.map((o, i) => (
                <ProductTableRow key={`${o.shop}-${o.url}-${start + i}`} offer={o} index={start + i} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} total={offers.length} onPage={goToPage} />
    </>
  );
}
