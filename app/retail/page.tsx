"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, BadgeCheck, ChevronRight, Loader2, Monitor, Search, Store, Tag, X,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/site/Reveal";
import { HorizontalChipRow } from "@/components/catalog/HorizontalChipRow";
import {
  RetailFilterButton,
  RetailFilterPanel,
  RetailSortSelect,
  type RetailFilterDraft,
} from "@/components/RetailFilterPanel";
import { RETAIL_PAGE_CARDS, retailPageCardSlug } from "@/lib/retailCategories";
import { countActiveRetailFilters, parseRetailListFilters, type RetailSortOption } from "@/lib/retailProductQuery";

type Product = {
  name: string;
  slug: string;
  brand: string;
  category: string;
  img: string;
  minPrice: number;
  maxPrice: number;
  shopNames: string[];
  discount: number | null;
};

/* ── Categories from retail catalog ─────────────────────────────────────── */
function isCatFilterActive(cardSlug: string, currentCat: string): boolean {
  if (!currentCat) return false;
  if (currentCat === cardSlug) return true;
  const cardSlugs = cardSlug.split(",");
  if (cardSlugs.includes(currentCat)) return true;
  return currentCat.split(",").every((s) => cardSlugs.includes(s));
}

const categories = RETAIL_PAGE_CARDS.map((card) => ({
  id: retailPageCardSlug(card.topId),
  fr: card.fr,
  ar: card.ar,
  count: null as number | null,
  img: card.img,
}));

/* ── Shops from retail catalog ───────────────────────────────────────────── */
const shops = [
  { key: "spacenet",   name: "SpaceNet",    count: 6697, color: "bg-blue-600",    imgs: ["https://spacenet.tn/93166-large_default/1-piles-maxell-6lr616lf22-9-v-alcaline.jpg","https://spacenet.tn/119661-large_default/adaptateur-dell-da310-usb-c-7-en-1-vers-hdmi-displayport-vga.jpg","https://spacenet.tn/190966-large_default/argentiere-sotufab-vitra-pm-chene-brute.jpg","https://spacenet.tn/59350-large_default/aspirateur-cylindrique-samsung-2000-w-noir-sc4581.jpg"] },
  { key: "tunisianet", name: "TunisiaNet",  count: 4651, color: "bg-red-600",     imgs: ["https://www.tunisianet.com.tn/311358-large/2x-piles-kodak-extra-heavy-duty-zinc-r20.jpg","https://www.tunisianet.com.tn/246368-large/4x-pile-kodak-ultra-alkaline-aa.jpg","https://www.tunisianet.com.tn/416818-large/adaptateur-usb-30-vers-type-c-femelle.jpg","https://www.tunisianet.com.tn/419613-large/apple-iphone-16-128-go-5g-noir.jpg"] },
  { key: "technopro",  name: "TechnoPro",   count: 3608, color: "bg-orange-500",  imgs: ["https://www.technopro-online.com/65323-large_default/appareil-a-raclette-traditionnel-livoo-600-watt-noir-doc159.jpg","https://www.technopro-online.com/110634-large_default/apple-ipad-10e-generation-2022-109-64go-wifi-silver.jpg","https://www.technopro-online.com/112129-large_default/climatiseur-tcl-18000-btu-chaud-froid-blanc.jpg","https://www.technopro-online.com/87239-large_default/barbecue-telefunken-electrique-2000w-240v-noir-m06474.jpg"] },
  { key: "affariyet",  name: "Affariyet",   count: 3346, color: "bg-emerald-600", imgs: ["https://www.affariyet.com/30129-medium_default/barbecue-electrique-avec-pied-grand-modele-princess-112247.jpg","https://www.affariyet.com/9750-medium_default/barre-de-musculation-180-cm-hammer-4607-4607.jpg","https://www.affariyet.com/76904-medium_default/ensemble-clavier-et-souris-gamer-filaire-spirit-of-gamer-ultimate-600-noir.jpg","https://www.affariyet.com/90783-medium_default/pc-portable-dell-pro-14-premium-pa14250-ultra-7-266v-16go-512go-ssd-noir.jpg"] },
  { key: "tunewtec",   name: "TuneWtec",    count: 2772, color: "bg-violet-600",  imgs: ["https://wiki.tn/wp-content/uploads/2024/03/apple-macbook-air-m1-8go-256go-ssd-silver.jpg","https://tunewtec.com/wp-content/uploads/2025/03/tp-link-tl-UE300-rj45.webp","https://tunewtec.com/wp-content/uploads/2022/09/afficheur-ecran-pour-pc-portable-156-led-40pin-agora-informatique.jpg","https://tunewtec.com/wp-content/uploads/2024/05/ordinateur-portable_641514.webp"] },
  { key: "jumbo",      name: "Jumbo",        count: 2093, color: "bg-yellow-500", imgs: ["https://jumbo.tn/31008-large_default/brosse-soufflante-schneider-schrb1000-puissance-1200-w-gris.jpg","https://jumbo.tn/9753-large_default/chaise-gaming-dowinx-ls6670-purple-avec-fonction-massage-et-repose-pied.jpg","https://jumbo.tn/25328-large_default/apple-macbook-air-m4-13-2025-16-go-256-go-ssd-bleu-minuit.jpg","https://jumbo.tn/32148-large_default/climatiseur-tcl-12000-btu-onoff-chaud-froid.jpg"] },
  { key: "kamounhome", name: "KamounHome",   count: 1137, color: "bg-teal-600",   imgs: ["https://kamounhome.tn/wp-content/uploads/2024/12/BATTERIE-12_5AH-FZ-110-TNN-GEL-ORIGINAL.jpeg","https://cdn.shopify.com/s/files/1/0073/9806/4175/files/tcl-18000-inverter_083cce34-9045-401c-9baa-20e33a6c3845.webp?v=1776853521","https://agora.tn/fr/50761-large_default/four-electrique-et-friteuse-sans-huile-raf-r-5347w-12l-blanc.webp","https://cdn.shopify.com/s/files/1/0073/9806/4175/files/air-fryer-raf-far-r5232w-1500w-5l-blanc.jpg?v=1769528886"] },
  { key: "maalejaudio",name: "MaalEjAudio",  count: 901,  color: "bg-pink-600",   imgs: ["https://www.technopro-online.com/87239-large_default/barbecue-telefunken-electrique-2000w-240v-noir-m06474.jpg","https://jmb.com.tn/wp-content/uploads/2023/06/batteur-electrique-ufesa-avec-bol-400-w-blanc-bv4655.jpg","https://agora.tn/fr/48409-large_default/centrifugeuse-juice-3-bosch-mes3500-700w-inox.webp","https://www.krichen-distribution.tn/wp-content/uploads/2024/12/barbecue-electrique-ufesa-bb6020-noir-2000w-2.jpg"] },
  { key: "zoom",       name: "Zoom",         count: 857,  color: "bg-sky-600",    imgs: ["https://zoom.com.tn/70278-small_default/climatiseur-saba-18000-btu-chaudfroid-blanc.jpg","https://agora.tn/fr/48409-large_default/centrifugeuse-juice-3-bosch-mes3500-700w-inox.webp","https://jumbo.tn/9749-large_default/chaise-gaming-dowinx-ls6670-gris-avec-accoudoirs-et-repose-pieds.jpg","https://cdn.shopify.com/s/files/1/0073/9806/4175/files/aspirateur_robot_xiaomi_e5_bhr8298eu_-_noir1.jpg?v=1775211992"] },
  { key: "darty",      name: "Darty",        count: 431,  color: "bg-red-500",    imgs: ["https://darty.tn/15302-medium_default/nettoyeur-a-vapeur-livoo-dom458-1300w-blanc.jpg","https://darty.tn/14885-medium_default/radiateur-seche-serviettes-jocca-2209-blanc.jpg","https://cdn.shopify.com/s/files/1/0073/9806/4175/files/tv-tcl-85-smart-tv-qled-mini-led-tv-tcl-85c6k-noir-1.jpg?v=1777564834","https://www.krichen-distribution.tn/wp-content/uploads/2024/11/presse-agrumes-kenwood-je280.png"] },
  { key: "itechstore", name: "iTechStore",   count: 228,  color: "bg-slate-700",  imgs: ["https://www.tunisianet.com.tn/473270-large/apple-macbook-air-m5-10core-cpu-10core-gpu-16g-1tssd-13-bleu-ciel-sans-adaptateur.jpg","https://www.tunisianet.com.tn/433194-large/apple-ipad-2025-11-256-go-wi-fi-rose.jpg","https://jumbo.tn/25328-large_default/apple-macbook-air-m4-13-2025-16-go-256-go-ssd-bleu-minuit.jpg","https://www.tunisianet.com.tn/479339-large/apple-macbook-air-m5-10core-cpu-10core-gpu-16g-1tssd-13-starlight-sans-adaptateur.jpg"] },
  { key: "scoop",      name: "ScoopGaming",  count: 221,  color: "bg-indigo-600", imgs: ["https://www.scoopgaming.com.tn/21124-large_default/boitier-spirit-of-gamer-spectra-artic-argb-moyen-tour-atx-white.jpg","https://spacenet.tn/119661-large_default/adaptateur-dell-da310-usb-c-7-en-1-vers-hdmi-displayport-vga.jpg","https://jumbo.tn/9753-large_default/chaise-gaming-dowinx-ls6670-purple-avec-fonction-massage-et-repose-pied.jpg","https://www.tunisianet.com.tn/320911-large/boite-d-alimentation-msi-mag-a600dn-600-watts-atx-80-plus-standard-noir.jpg"] },
];

const LIMIT = 24;

/* ── Shop display name map ───────────────────────────────────────────────── */
const shopDisplayName: Record<string, string> = {
  spacenet:"SpaceNet", tunisianet:"TunisiaNet", technopro:"TechnoPro",
  affariyet:"Affariyet", tunewtec:"TuneWtec", jumbo:"Jumbo",
  kamounhome:"KamounHome", maalejaudio:"MaalEjAudio", zoom:"Zoom",
  darty:"Darty", itechstore:"iTechStore", scoop:"ScoopGaming",
  sbs:"SBS Informatique", agora:"Agora", jmb:"JMB", allani:"Allani",
  koktahome:"KoktaHome", el_farabi:"El Farabi", krichen:"Krichen",
  bstech:"BSTech", taktek:"TakTek", wiki:"Wiki.tn", bill:"Bill",
  topbureau:"TopBureau", zoom2:"Zoom", mytek:"Mytek", ispace:"iSpace",
};

function displayName(key: string) {
  return shopDisplayName[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function RetailPage() {
  return (
    <Suspense fallback={null}>
      <RetailPageInner />
    </Suspense>
  );
}

function RetailPageInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const scrollOnPageChange = useRef(false);

  const catFromUrl = sp.get("cat") ?? "";
  const shopFromUrl = sp.get("shop") ?? "";
  const qFromUrl = sp.get("q") ?? "";
  const brandFromUrl = sp.get("brand") ?? "";
  const minFromUrl = sp.get("min") ?? "";
  const maxFromUrl = sp.get("max") ?? "";
  const specRamFromUrl = sp.get("spec_ram") ?? "";
  const specStorageFromUrl = sp.get("spec_storage") ?? "";
  const specScreenFromUrl = sp.get("spec_screen") ?? "";
  // Default to "true" (Produits similaires) when the URL has no `matched` param —
  // matched products are the meaningful comparison set, so we show them first.
  const matchedFromUrl = sp.get("matched") ?? "true";
  const sortFromUrl = parseRetailListFilters(sp).sort;
  const seedFromUrl = sp.get("seed") ?? "";

  const [products, setProducts]   = useState<Product[]>([]);
  const [total, setTotal]         = useState(0);
  const [totalAll, setTotalAll]   = useState(0);
  const [shopCount, setShopCount] = useState(0);
  const [page, setPage]           = useState(0);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch] = useState(qFromUrl);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<RetailFilterDraft>({
    cat: "",
    shop: "",
    brand: "",
    minPrice: "",
    maxPrice: "",
    specRam: "",
    specStorage: "",
    specScreen: "",
    matched: "",
    sort: "random",
  });
  const [dynShops, setDynShops]     = useState<{ key: string; name: string }[]>([]);
  const [dynCats, setDynCats]       = useState<{ id: number; name: string; slug: string }[]>([]);

  const activeFilterCount = countActiveRetailFilters(parseRetailListFilters(sp));

  const replaceParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(sp.toString());
      for (const [key, val] of Object.entries(patch)) {
        if (val === null || val === undefined || val === "") params.delete(key);
        else params.set(key, val);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, sp],
  );

  // Give the "Aléatoire" (default) sort a per-session seed so the shuffle stays
  // stable across pagination instead of reshuffling on every request. Generated
  // once, synchronously, on first render (not in an effect) so the very first
  // fetch already uses it — writing it into the URL afterward is just for
  // shareable/bookmarkable links, not load-bearing for correctness.
  const [localSeed] = useState(() => String(Math.floor(Math.random() * 1_000_000_000)));

  useEffect(() => {
    if (sortFromUrl !== "random" || seedFromUrl) return;
    const params = new URLSearchParams(sp.toString());
    params.set("seed", localSeed);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortFromUrl, seedFromUrl]);

  const syncDraftFromUrl = useCallback(() => {
    setFilterDraft({
      cat: catFromUrl,
      shop: shopFromUrl,
      brand: brandFromUrl,
      minPrice: minFromUrl,
      maxPrice: maxFromUrl,
      specRam: specRamFromUrl,
      specStorage: specStorageFromUrl,
      specScreen: specScreenFromUrl,
      matched:
        matchedFromUrl === "true" || matchedFromUrl === "false"
          ? matchedFromUrl
          : "",
      sort: sortFromUrl,
    });
  }, [
    catFromUrl, shopFromUrl, brandFromUrl, minFromUrl, maxFromUrl,
    specRamFromUrl, specStorageFromUrl, specScreenFromUrl, matchedFromUrl, sortFromUrl,
  ]);

  const setActiveCat = useCallback(
    (cat: string) => {
      setPage(0);
      replaceParams({ cat: cat || null });
    },
    [replaceParams],
  );

  const openFilters = () => {
    syncDraftFromUrl();
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setPage(0);
    replaceParams({
      cat: filterDraft.cat || null,
      shop: filterDraft.shop || null,
      brand: filterDraft.brand || null,
      min: filterDraft.minPrice || null,
      max: filterDraft.maxPrice || null,
      spec_ram: filterDraft.specRam || null,
      spec_storage: filterDraft.specStorage || null,
      spec_screen: filterDraft.specScreen || null,
      matched: filterDraft.matched || null,
      sort: filterDraft.sort === "random" ? null : filterDraft.sort,
    });
    setFiltersOpen(false);
  };

  const setSort = useCallback(
    (sort: RetailSortOption) => {
      setPage(0);
      replaceParams({ sort: sort === "random" ? null : sort });
    },
    [replaceParams],
  );

  const resetFilters = useCallback(() => {
    setPage(0);
    setFilterDraft({
      cat: "",
      shop: "",
      brand: "",
      minPrice: "",
      maxPrice: "",
      specRam: "",
      specStorage: "",
      specScreen: "",
      matched: "",
      sort: "random",
    });
    replaceParams({
      cat: null,
      shop: null,
      brand: null,
      min: null,
      max: null,
      spec_ram: null,
      spec_storage: null,
      spec_screen: null,
      matched: null,
      sort: null,
    });
  }, [replaceParams]);

  const goToPage = useCallback((idx: number) => {
    scrollOnPageChange.current = true;
    setPage(idx);
  }, []);

  // Sync search input when URL changes (mega menu, back/forward, shared links)
  useEffect(() => {
    setSearch(qFromUrl);
  }, [qFromUrl]);

  // The actual params sent to the API must always carry the *effective*
  // values (matched defaults to "true", sort defaults to "random" with a
  // seed) even before the URL itself has been written to reflect them —
  // otherwise the very first request on a fresh /retail visit queries the
  // unfiltered full catalogue (or an unseeded random order) while the UI
  // still displays "Produits similaires" as selected, which can render an
  // empty/mismatched list until a later interaction corrects the URL.
  const effectiveParams = useMemo(() => {
    const params = new URLSearchParams(sp.toString());
    if (!params.has("matched")) params.set("matched", "true");
    if (!params.has("seed")) params.set("seed", localSeed);
    return params;
  }, [sp, localSeed]);
  const queryString = effectiveParams.toString();
  const filterRef = useRef(queryString);

  const fetchProducts = useCallback(async (p: number, qs: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams(qs);
      params.set("page", String(p));
      params.set("limit", String(LIMIT));
      const res  = await fetch(`/api/retail-products?${params}`);
      const data = await res.json();
      setProducts(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let p = page;
    if (filterRef.current !== queryString) {
      filterRef.current = queryString;
      p = 0;
      if (page !== 0) setPage(0);
    }
    fetchProducts(p, queryString);
  }, [page, queryString, fetchProducts]);

  useEffect(() => {
    if (!scrollOnPageChange.current) return;
    scrollOnPageChange.current = false;
    toolbarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page]);

  useEffect(() => {
    fetch("/api/retail-products?limit=1")
      .then(r => r.json())
      .then(d => {
        setTotalAll(d.total);
        setShopCount(d.shopCount ?? 0);
        if (d.allShops?.length) setDynShops(d.allShops);
        if (d.allCats?.length)  setDynCats(d.allCats);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = search.trim();
      if (trimmed === qFromUrl) return;
      const patch: Record<string, string | null> = { q: trimmed || null };
      if (!trimmed && sortFromUrl === "relevance") {
        patch.sort = null;
      }
      replaceParams(patch);
    }, 350);
    return () => clearTimeout(t);
  }, [search, qFromUrl, sortFromUrl, replaceParams]);

  const totalPages = Math.ceil(total / LIMIT);

  const facetQuery = useMemo(() => {
    const p = new URLSearchParams();
    const src = filtersOpen ? filterDraft : {
      cat: catFromUrl,
      shop: shopFromUrl,
      matched: matchedFromUrl,
    };
    if (qFromUrl) p.set("q", qFromUrl);
    if (src.cat) p.set("cat", src.cat);
    if (src.shop) p.set("shop", src.shop);
    if (src.matched) p.set("matched", src.matched);
    return p.toString();
  }, [filtersOpen, filterDraft, catFromUrl, shopFromUrl, qFromUrl, matchedFromUrl]);

  const shopList = dynShops.length > 0 ? dynShops : shops.map((s) => ({ key: s.key, name: s.name }));

  return (
    <main className="min-h-screen bg-white dark:bg-[#0a0e1a]">
      <Header />

      {/* ── Breadcrumb ────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-[1600px] px-4 pt-3 sm:pt-5">
        <nav className="reveal-up mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/40 sm:mb-4 sm:text-[11px]">
          <Link href="/" className="transition hover:text-brand-gold">Accueil</Link>
          <ChevronRight className="h-3 w-3 opacity-60" />
          <span className="text-brand-gold">Magasins</span>
        </nav>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <Reveal>
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-4 sm:rounded-2xl sm:p-6 md:p-8 dark:border-white/5 dark:from-[#0f1422] dark:via-[#0f1422] dark:to-[#0f1528]">
            <div className="pointer-events-none absolute -left-12 -top-12 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-brand-gold/8 blur-3xl" />

            <div className="relative flex flex-col gap-4 sm:gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3 sm:gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-400/25 to-indigo-500/10 ring-1 ring-blue-400/30 shadow-[0_0_30px_-8px_rgba(59,130,246,0.4)] sm:h-16 sm:w-16 sm:rounded-2xl">
                  <Monitor className="h-6 w-6 text-blue-500 dark:text-blue-400 sm:h-8 sm:w-8" strokeWidth={1.8} />
                </span>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl md:text-4xl dark:text-white">
                    Magasins <span className="gradient-text-gold">Tunisie</span>
                  </h1>
                  <p className="mt-0.5 font-arabic text-sm text-slate-500 dark:text-white/50 sm:mt-1 sm:text-base" dir="rtl">
                    التجزئة — قارن الأسعار على المنتجات التقنية والمنزلية
                  </p>
                  <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-600 dark:text-white/65 sm:mt-2 sm:text-sm">
                    Comparez les prix de <span className="font-bold text-slate-900 dark:text-white">{totalAll > 0 ? totalAll.toLocaleString("fr-FR") : "…"}</span> produits tech & électroménager
                    sur <span className="font-bold text-slate-900 dark:text-white">{shopCount > 0 ? `${shopCount}+` : "…"} enseignes</span> tunisiennes.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0 sm:flex-wrap">
                {[
                  { label: "Produits",   value: totalAll > 0 ? totalAll.toLocaleString("fr-FR") : "…", cls: "border-brand-gold/25 bg-brand-gold/10 text-brand-gold" },
                  { label: "Enseignes",  value: shopCount > 0 ? String(shopCount) : "…",               cls: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300" },
                  { label: "Catégories", value: dynCats.length > 0 ? String(dynCats.length) : "…",      cls: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" },
                ].map((c) => (
                  <div key={c.label} className={`flex-1 rounded-lg border px-2.5 py-1.5 sm:flex-none sm:rounded-xl sm:px-4 sm:py-2.5 ${c.cls}`}>
                    <div className="text-base font-black tabular-nums leading-none sm:text-xl">{c.value}</div>
                    <div className="mt-0.5 text-[9px] uppercase tracking-wider opacity-80 sm:text-[10px]">{c.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-brand-gold/35 to-transparent sm:mt-6" />
          </div>
        </Reveal>
      </div>

      {/* ── Categories ────────────────────────────────────────────────────── */}
      <section className="mt-4 sm:mt-8">
        <HorizontalChipRow
          title="Catégories"
          titleAccent="magasins"
          activeId={categories.find((c) => isCatFilterActive(c.id, catFromUrl))?.id ?? ""}
          autoScroll
          onSelect={(id) => setActiveCat(isCatFilterActive(id, catFromUrl) ? "" : id)}
          items={categories.map((cat) => ({
            id: cat.id,
            label: cat.fr,
            image: cat.img,
          }))}
        />
      </section>

      {/* ── Catalogue / Similaires toggle ────────────────────────────────── */}
      <div className="mx-auto mt-4 max-w-[1600px] px-4 sm:mt-5">
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/[0.08] dark:bg-white/[0.04]">
          {[
            { key: "all",  label: "Catalogue complet" },
            { key: "true", label: "Produits similaires" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setPage(0); replaceParams({ matched: key }); }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                matchedFromUrl === key
                  ? "bg-white text-slate-900 shadow-sm dark:bg-white/[0.1] dark:text-white"
                  : "text-slate-500 hover:text-slate-700 dark:text-white/45 dark:hover:text-white/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Search + filters ──────────────────────────────────────────────── */}
      <section ref={toolbarRef} className="mx-auto mt-4 max-w-[1600px] scroll-mt-20 px-4 sm:mt-4">
        <RetailFilterPanel
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          draft={filterDraft}
          onChange={(patch) => setFilterDraft((d) => ({ ...d, ...patch }))}
          onApply={applyFilters}
          onReset={resetFilters}
          activeCount={activeFilterCount}
          shops={shopList}
          facetQuery={facetQuery}
          hasSearch={Boolean(qFromUrl)}
        />

        <div className="flex items-center gap-2.5">
          <div className="group relative min-w-0 flex-1">
            <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-focus-within:opacity-100 [box-shadow:0_0_0_3px_rgba(246,196,83,0.18),0_4px_24px_-4px_rgba(246,196,83,0.25)]" />
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-focus-within:text-brand-gold dark:text-white/30" />
            <input
              type="search"
              placeholder="Rechercher un produit, marque ou référence…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-10 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-brand-gold/50 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:placeholder:text-white/30 dark:focus:border-brand-gold/40 sm:text-base"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 transition hover:text-slate-700 dark:text-white/30 dark:hover:text-white/70">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <RetailFilterButton onClick={openFilters} activeCount={activeFilterCount} />

          <RetailSortSelect
            value={sortFromUrl}
            onChange={setSort}
            hasSearch={Boolean(qFromUrl)}
            className="hidden shrink-0 sm:block"
          />

          <span className="hidden text-sm text-slate-500 dark:text-white/40 shrink-0 tabular-nums lg:inline">
            {total.toLocaleString("fr-FR")} produit{total > 1 ? "s" : ""}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 sm:hidden">
          <RetailSortSelect
            value={sortFromUrl}
            onChange={setSort}
            hasSearch={Boolean(qFromUrl)}
            className="min-w-0 flex-1"
          />
          <span className="text-[10px] text-slate-400 dark:text-white/35 shrink-0 tabular-nums">
            {total.toLocaleString("fr-FR")} produit{total > 1 ? "s" : ""}
          </span>
        </div>

        <p className="mt-1.5 hidden text-[10px] text-slate-400 dark:text-white/35 sm:block lg:hidden tabular-nums">
          {total.toLocaleString("fr-FR")} produit{total > 1 ? "s" : ""}
        </p>
      </section>

      {/* ── Products grid ─────────────────────────────────────────────────── */}
      <section className="mx-auto mt-5 max-w-[1600px] px-4">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-brand-gold" />
          </div>
        ) : products.length === 0 ? (
          <div className="py-24 text-center text-slate-400 dark:text-white/40">
            <div className="text-5xl mb-4">🔍</div>
            <p className="font-semibold">Aucun produit trouvé</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {products.map((p, i) => {
              const savings = p.maxPrice - p.minPrice;
              const fmt = (n: number) => n.toLocaleString("fr-FR");
              return (
                <Link
                  key={p.slug || `${p.name}-${i}`}
                  href={`/retail/${p.slug}`}
                  className="card group relative flex flex-col overflow-hidden p-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-brand-gold/40 dark:hover:border-brand-gold/40"
                >
                  {/* discount badge */}
                  {p.discount && (
                    <span className="absolute right-2.5 top-2.5 z-10 rounded-full bg-brand-red px-2.5 py-1 text-[10px] font-black text-white shadow-md">
                      −{p.discount}%
                    </span>
                  )}

                  {/* image */}
                  <div className="relative h-48 w-full overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100 dark:from-white/[0.06] dark:to-white/[0.02]">
                    <img
                      src={p.img}
                      alt={p.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-contain p-2 transition duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                    <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-bold text-slate-700 shadow-sm backdrop-blur dark:bg-black/50 dark:text-white/80">
                      <Store className="h-2.5 w-2.5" />
                      {p.shopNames.length} boutique{p.shopNames.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* info */}
                  <div className="flex flex-1 flex-col p-3.5">
                    {p.brand && (
                      <div className="mb-1 text-[12.5px] font-extrabold uppercase tracking-wider text-brand-gold transition-transform duration-300 group-hover:translate-x-0.5">
                        {p.brand}
                      </div>
                    )}
                    <h3 className="text-[12.5px] font-bold leading-snug text-slate-900 line-clamp-2 dark:text-white">
                      {p.name}
                    </h3>
                    <div className="mt-0.5 text-[10px] capitalize text-slate-500 dark:text-white/45">{p.category}</div>

                    {/* price */}
                    <div className="mt-2.5 flex items-baseline gap-2">
                      <span className="text-xl font-black text-brand-gold tabular-nums">
                        {fmt(p.minPrice)} <span className="text-[11px] font-bold">DT</span>
                      </span>
                      {savings > 0.5 && (
                        <span className="text-[11px] text-slate-400 line-through dark:text-white/35 tabular-nums">
                          {fmt(p.maxPrice)} DT
                        </span>
                      )}
                    </div>

                    {/* per-shop price rows */}
                    <div className="mt-2.5 flex flex-col gap-1 border-t border-slate-100 pt-2.5 dark:border-white/[0.06]">
                      {p.shopNames.slice(0, 3).map((shop, si) => {
                        // All shops share the same price when the spread is
                        // negligible — don't crown a "cheapest".
                        const allEqual = savings <= 0.5;
                        const price = allEqual || p.shopNames.length === 1
                          ? p.minPrice
                          : p.minPrice + (savings * si) / Math.max(p.shopNames.length - 1, 1);
                        const highlightCheapest = si === 0 && !allEqual;
                        const highlightEqual = si === 0 && allEqual && p.shopNames.length > 1;
                        return (
                          <div
                            key={shop}
                            className={`flex items-center justify-between rounded-md px-2 py-1 text-[11px] ${
                              highlightCheapest
                                ? "bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                                : highlightEqual
                                ? "bg-sky-50 font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"
                                : "text-slate-600 dark:text-white/60"
                            }`}
                          >
                            <span className="flex items-center gap-1 truncate">
                              {highlightCheapest && <BadgeCheck className="h-3 w-3 shrink-0" />}
                              <span className="truncate">{displayName(shop)}</span>
                              {highlightEqual && (
                                <span className="ml-1 shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-sky-700 dark:bg-sky-500/20 dark:text-sky-200">
                                  Égalité
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 tabular-nums font-bold">{fmt(price)} DT</span>
                          </div>
                        );
                      })}
                      {p.shopNames.length > 3 && (
                        <span className="px-2 text-[10px] font-medium text-slate-400 dark:text-white/40">
                          +{p.shopNames.length - 3} autre{p.shopNames.length - 3 > 1 ? "s" : ""} boutique{p.shopNames.length - 3 > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* ── Pagination ──────────────────────────────────────────────────── */}
        {!loading && totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2 flex-wrap">
            <button onClick={() => goToPage(0)} disabled={page === 0} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand-gold/40 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:text-white">«</button>
            <button onClick={() => goToPage(Math.max(0, page - 1))} disabled={page === 0} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-gold/40 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:text-white">← Précédent</button>

            {Array.from({ length: totalPages }).map((_, idx) => {
              if (idx !== 0 && idx !== totalPages - 1 && Math.abs(idx - page) > 2) return null;
              if (Math.abs(idx - page) === 3) return <span key={idx} className="text-slate-400 dark:text-white/30">…</span>;
              return (
                <button key={idx} onClick={() => goToPage(idx)} className={`h-9 w-9 rounded-xl text-sm font-bold transition ${page === idx ? "bg-brand-gold text-black shadow" : "border border-slate-200 bg-white text-slate-700 hover:border-brand-gold/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"}`}>
                  {idx + 1}
                </button>
              );
            })}

            <button onClick={() => goToPage(Math.min(totalPages - 1, page + 1))} disabled={page === totalPages - 1} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-gold/40 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:text-white">Suivant →</button>
            <button onClick={() => goToPage(totalPages - 1)} disabled={page === totalPages - 1} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand-gold/40 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:text-white">»</button>

            <span className="ml-2 text-xs text-slate-400 dark:text-white/40 tabular-nums">Page {page + 1} / {totalPages}</span>
          </div>
        )}
      </section>

      {/* ── Shops ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto mt-14 max-w-[1600px] px-4">
        <Reveal>
          <div className="mb-5 flex items-center gap-3">
            <Monitor className="h-5 w-5 text-brand-gold" />
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              Enseignes <span className="gradient-text-gold">magasins</span>
            </h2>
            <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-300">
              30+ boutiques
            </span>
          </div>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((shop, i) => (
            <Reveal key={shop.key} delay={i * 0.04}>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.025]">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-[11px] font-black text-white ${shop.color}`}>
                      {shop.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{shop.name}</div>
                      <div className="text-[11px] text-slate-400 dark:text-white/40">{shop.count.toLocaleString("fr-FR")} offres comparées</div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-0.5 bg-slate-100 dark:bg-white/[0.04]">
                  {shop.imgs.map((img, j) => (
                    <div key={j} className="relative aspect-square overflow-hidden bg-white dark:bg-[#0f1422]">
                      <img src={img} alt="" referrerPolicy="no-referrer" className="h-full w-full object-contain p-1.5" loading="lazy" />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="h-1.5 flex-1 mr-4 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.08]">
                    <div className={`h-full rounded-full ${shop.color} opacity-70`} style={{ width: `${Math.round((shop.count / 6697) * 100)}%` }} />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPage(0);
                      replaceParams({ cat: null, shop: shop.key, q: null });
                      setSearch("");
                      window.scrollTo({ top: 600, behavior: "smooth" });
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold text-brand-gold hover:underline shrink-0"
                  >
                    Explorer <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="mx-auto mt-14 max-w-[1600px] px-4 pb-12">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-brand-gold/20 bg-gradient-to-br from-[#0d1424] via-[#0b0f1d] to-[#0a0e1a] p-8 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] sm:p-10">
            {/* decorative glows + grid */}
            <div className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -right-12 bottom-0 h-56 w-56 rounded-full bg-brand-red/15 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:32px_32px]" />

            <div className="relative flex flex-col items-center gap-8 lg:flex-row lg:justify-between">
              {/* Left: branded badge + copy */}
              <div className="flex flex-col items-center text-center lg:flex-row lg:items-center lg:gap-6 lg:text-left">
                <div className="relative mb-5 shrink-0 lg:mb-0">
                  <div className="absolute inset-0 -z-10 rounded-3xl bg-sky-500/30 blur-2xl" />
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-400 to-blue-600 shadow-[0_10px_30px_-8px_rgba(59,130,246,0.6)] ring-1 ring-white/20">
                    <Monitor className="h-10 w-10 text-white" strokeWidth={2} />
                  </div>
                </div>
                <div>
                  <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-300">
                    <Tag className="h-3 w-3" /> Meilleur prix garanti
                  </span>
                  <h3 className="text-2xl font-black leading-tight text-white sm:text-3xl">
                    Comparez <span className="gradient-text-gold">tous les prix</span> retail
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-white/65">
                    Tech, informatique, électroménager. Comparez 30+ enseignes et trouvez le meilleur prix avant d'acheter.
                  </p>
                  {/* category badges */}
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                    {["Smartphones", "Informatique", "TV & Audio", "Électroménager"].map((s) => (
                      <span
                        key={s}
                        className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-white/75"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: stats + CTA */}
              <div className="flex shrink-0 flex-col items-center gap-4 lg:items-end">
                <div className="flex gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-center">
                    <div className="text-2xl font-black tabular-nums text-white">{totalAll > 0 ? totalAll.toLocaleString("fr-FR") : "…"}</div>
                    <div className="text-[11px] font-medium text-white/50">produits</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-center">
                    <div className="text-2xl font-black tabular-nums text-white">{shopCount > 0 ? shopCount : "…"}</div>
                    <div className="text-[11px] font-medium text-white/50">enseignes</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <Footer />
    </main>
  );
}
