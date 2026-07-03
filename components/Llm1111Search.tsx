"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Sparkles, Loader2, ArrowRight, Store, ChevronLeft, ChevronRight, X, Search, Check } from "lucide-react";

const PAGE_SIZE = 6; // nombre de cartes produits par page

type Offer = {
  shop_key: string;
  shop_name: string;
  name: string;
  price: number;
  stock_status: string;
  url: string | null;
  image: string | null;
  similarity: number;
};

type Group = {
  title: string;
  image: string | null;
  offers: Offer[];
  min_price: number;
  relevance?: number;
  is_accessory?: boolean;
};

type ApiResponse = {
  query: string;
  count?: number;
  results: Group[];
  explanation?: string;
  error?: string;
};

const PLACEHOLDERS = [
  "PC Portable Lenovo IdeaPad i5 16Go 512Go…",
  "Climatiseur Gree 12000 BTU Inverter…",
  "Réfrigérateur Samsung 500L No Frost…",
  "iPhone 15 128Go…",
  "Machine à laver 8Kg Samsung…",
];

const STOCK_LABEL: Record<string, { label: string; cls: string }> = {
  en_stock: { label: "En stock", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  en_arrivage: { label: "En arrivage", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  sur_commande: { label: "Sur commande", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  rupture: { label: "Rupture", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  inconnu: { label: "—", cls: "bg-white/5 text-white/40 border-white/10" },
};

export function Llm1111Search() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState(""); // question affichée en bulle chat
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [focused, setFocused] = useState(false);
  const [page, setPage] = useState(0); // page de résultats courante
  const [modalOpen, setModalOpen] = useState(false); // fenêtre chat pop-up
  const inputRef = useRef<HTMLInputElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Fermeture du pop-up : touche Échap + verrouillage du scroll de fond
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  function closeModal() {
    setModalOpen(false);
  }

  // Rotating placeholder animation
  useEffect(() => {
    if (focused || query) return;
    const id = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(id);
  }, [focused, query]);

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setData(null);
    setSubmitted(q);
    setPage(0);
    setModalOpen(true);
    try {
      const res = await fetch("/api/llm-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const json: ApiResponse = await res.json();
      setData(json);
    } catch {
      setData({ query: q, results: [], error: "Une erreur est survenue. Réessayez." });
    } finally {
      setLoading(false);
    }
  }

  // "TOP PRIX" = le produit RÉEL le moins cher (on ignore les accessoires
  // comme un câble à 2 DT qui ne doit pas être couronné meilleur prix)
  const realGroups = data?.results?.filter((g) => !g.is_accessory) ?? [];
  const globalCheapest = realGroups.length
    ? realGroups.reduce((a, b) => (b.min_price < a.min_price ? b : a)).min_price
    : null;

  return (
    <section className="mx-auto mt-5 max-w-[1600px] px-3 sm:px-4">
      <div className="relative">
        {/* Carte principale — style natif du site (rounded-2xl, tokens bg, blobs discrets) */}
        <div className="relative overflow-hidden rounded-2xl border border-bg-border bg-gradient-to-br from-slate-50 to-white p-5 shadow-card dark:from-bg-700 dark:to-bg-800 sm:p-7">
          {/* blobs d'accent doux, comme le Hero */}
          <div aria-hidden className="pointer-events-none absolute -left-8 -top-10 h-52 w-52 rounded-full bg-brand-red/10 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-12 right-0 h-52 w-52 rounded-full bg-brand-gold/10 blur-3xl" />
          <style>{`
            @keyframes llmShimmer { to { background-position: 200% center; } }
            @keyframes btnGlow {
              0%,100% { box-shadow: 0 0 0 0 rgba(246,196,83,0.35); }
              50% { box-shadow: 0 0 22px 3px rgba(246,196,83,0.45); }
            }
            @keyframes cardIn {
              from { opacity: 0; transform: translateY(18px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes bubbleIn {
              from { opacity: 0; transform: translateY(8px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes modalIn {
              from { opacity: 0; transform: translateY(30px) scale(0.98); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            .llm-card { animation: cardIn 0.5s cubic-bezier(0.16,1,0.3,1) both; }
            .llm-bubble { animation: bubbleIn 0.35s ease-out both; }
            .llm-shine {
              position: absolute; inset: 0; pointer-events: none;
              background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%);
              transform: translateX(-120%); transition: transform 0.8s ease;
            }
            .group\\/card:hover .llm-shine { transform: translateX(120%); }
          `}</style>

          {/* Header row : titre à gauche, vidéo robot à droite */}
          <div className="relative mb-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
              {/* Bloc titre */}
              <div className="flex min-w-0 flex-1 flex-col gap-4 sm:gap-5">
                <div className="flex items-start gap-4">
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 ring-1 ring-slate-300 shadow-card dark:from-bg-700 dark:to-bg-800 dark:ring-white/10 sm:h-14 sm:w-14">
                    <Image src="/mascot.png" alt="1111" width={36} height={36} className="object-contain drop-shadow-[0_4px_8px_rgba(225,29,45,0.35)] sm:h-10 sm:w-10" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/50">
                      Moteur de comparaison
                    </p>
                    <h2 className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[1.75rem] font-black leading-none tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:text-[2rem]">
                      <span>1111</span>
                      <span className="gradient-text-gold">Recherche intelligent</span>
                    </h2>
                  </div>
                </div>

                <p className="max-w-lg text-sm leading-relaxed text-slate-600 dark:text-white/70 sm:text-[15px]">
                  Décrivez un produit en langage naturel — nous l&apos;identifions chez chaque revendeur et mettons en évidence le{" "}
                  <span className="font-semibold text-slate-800 dark:text-white">meilleur tarif disponible</span>.
                </p>

                <ul className="flex flex-wrap gap-x-4 gap-y-2">
                  {["Comparaison multi-boutiques", "Analyse sémantique", "Résultats instantanés"].map((item) => (
                    <li key={item} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-white/60">
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-500" strokeWidth={2.5} />
                      {item}
                    </li>
                  ))}
                </ul>

                {/* Boutiques indexées + logos */}
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-white/45">
                    Catalogues indexés
                  </span>
                  <div className="flex items-center gap-6">
                  {[
                    { src: "/shop-logos/spacenet.svg", alt: "Spacenet" },
                    { src: "/shop-logos/mytek.png", alt: "Mytek" },
                    { src: "/shop-logos/tunisianet.jpg", alt: "Tunisianet" },
                  ].map((logo) => (
                    <div
                      key={logo.alt}
                      className="flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 dark:border-transparent dark:bg-transparent dark:shadow-none dark:hover:border-transparent"
                      title={logo.alt}
                    >
                      <Image
                        src={logo.src}
                        alt={logo.alt}
                        width={160}
                        height={60}
                        className="h-9 w-auto object-contain sm:h-10 dark:brightness-110 dark:contrast-[1.05]"
                      />
                    </div>
                  ))}
                  </div>
                </div>
              </div>

              {/* Vidéo robot à droite */}
              <div className="hidden shrink-0 lg:flex lg:items-center lg:justify-center">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="relative block h-28 w-auto drop-shadow-[0_8px_20px_rgba(15,23,42,0.18)] dark:drop-shadow-none xl:h-32"
                >
                  <source src="/robot_transparent.webm" type="video/webm" />
                </video>
              </div>
            </div>

            {/* Séparateur doré */}
            <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-brand-gold/50 to-transparent dark:via-brand-gold/30" />
          </div>

          {/* Zone de recherche */}
          <div className="relative space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-white/45">
                Requête produit
              </p>
              <span className="hidden text-[10px] text-slate-400 dark:text-white/35 sm:inline">
                Langage naturel accepté
              </span>
            </div>

            <form onSubmit={handleSearch}>
              <div
                className={`group flex items-center gap-2 rounded-2xl border p-1.5 transition-all duration-300 ${
                  focused
                    ? "border-brand-gold/50 bg-white shadow-[0_0_0_3px_rgba(246,196,83,0.15)] dark:border-brand-gold/40 dark:bg-bg-900 dark:shadow-[0_0_0_3px_rgba(246,196,83,0.12)]"
                    : "border-slate-300 bg-slate-50 shadow-sm hover:border-brand-gold/40 dark:border-bg-border dark:bg-bg-900 dark:shadow-none dark:hover:border-brand-gold/30"
                }`}
              >
                <Search
                  className={`ml-1 h-5 w-5 shrink-0 transition-colors ${
                    focused ? "text-brand-gold" : "text-slate-400 dark:text-white/40"
                  }`}
                />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder={`Demandez à 1111 LLM… ex : ${PLACEHOLDERS[placeholderIdx]}`}
                  className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white dark:placeholder:text-white/35 sm:text-base"
                />
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="btn-gold shrink-0 whitespace-nowrap px-4 py-2 text-sm shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="hidden sm:inline">Analyse…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Analyser</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Exemples de requêtes */}
            {!data && !loading && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-white/40">
                  Exemples
                </span>
                {["Climatiseur Gree 12000 BTU", "iPhone 15 128Go", "PC Portable Lenovo i5 16Go"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setQuery(s);
                      setTimeout(() => handleSearch(), 50);
                    }}
                    className="chip"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ═══════════ FENÊTRE POP-UP CHAT (style LLM) ═══════════ */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          style={{ animation: "overlayIn 0.25s ease-out both" }}
        >
          {/* Fond flouté cliquable pour fermer */}
          <div
            aria-hidden
            onClick={closeModal}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md dark:bg-black/70"
          />

          {/* Fenêtre */}
          <div
            className="relative flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-bg-border bg-bg-card shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)] dark:border-white/10 sm:h-[85vh] sm:rounded-2xl"
            style={{ animation: "modalIn 0.35s cubic-bezier(0.16,1,0.3,1) both" }}
          >
            {/* En-tête */}
            <div className="relative flex shrink-0 items-center justify-between gap-3 border-b border-bg-border bg-bg-card px-4 py-3.5 dark:border-white/10 sm:px-6">
              <div className="relative flex items-center gap-3">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 ring-1 ring-slate-300 shadow-sm dark:from-bg-700 dark:to-bg-800 dark:ring-white/10">
                  <Image src="/mascot.png" alt="1111" width={26} height={26} className="object-contain drop-shadow-[0_2px_6px_rgba(225,29,45,0.3)]" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-white/50">
                    Moteur de comparaison
                  </p>
                  <span className="mt-0.5 block text-base font-black leading-none text-slate-900 dark:text-white">
                    1111 <span className="gradient-text-gold">LLM</span>
                  </span>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-bg-border text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 dark:border-white/10 dark:text-white/60 dark:hover:border-white/20 dark:hover:bg-white/5 dark:hover:text-white"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Corps scrollable */}
            <div className="flex-1 space-y-4 overflow-y-auto bg-slate-100/70 px-4 py-5 dark:bg-bg-900 sm:px-6">
              {/* Question utilisateur */}
              {submitted && (
                <div className="flex justify-end">
                  <div className="llm-bubble max-w-[85%] rounded-2xl rounded-br-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm dark:border-white/10 dark:bg-bg-card dark:text-white">
                    {submitted}
                  </div>
                </div>
              )}

          {/* Chargement */}
          {loading && (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-gold/20 to-brand-gold/5 ring-1 ring-brand-gold/20">
                <Image src="/mascot.png" alt="1111" width={20} height={20} className="object-contain" />
              </div>
              <div className="flex flex-col gap-2.5 rounded-2xl rounded-tl-md border border-bg-border bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-bg-card">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-white/70">
                  <Loader2 className="h-4 w-4 animate-spin text-brand-gold" />
                  Analyse des catalogues en cours…
                </div>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-brand-gold/70"
                      style={{ animation: `pulse 1.2s ${i * 0.2}s infinite` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Résultats */}
          {data && !loading && (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-gold/20 to-brand-gold/5 ring-1 ring-brand-gold/20">
                <Image src="/mascot.png" alt="1111" width={20} height={20} className="object-contain" />
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                {data.error ? (
                  <div className="rounded-2xl rounded-tl-md border border-red-200 bg-red-50 px-4 py-3 dark:border-red-500/30 dark:bg-red-500/10">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-500 dark:text-red-400">Erreur</p>
                    <p className="mt-1 text-sm text-red-700 dark:text-red-300">{data.error}</p>
                  </div>
                ) : data.results.length === 0 ? (
                  <div className="rounded-2xl rounded-tl-md border border-bg-border bg-white px-4 py-3 dark:border-white/10 dark:bg-bg-card">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/40">Aucun résultat</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-white/65">
                      Aucun produit trouvé pour cette recherche. Essayez une autre formulation.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Texte de réponse du LLM */}
                    {data.explanation && (
                      <div className="rounded-2xl rounded-tl-md border border-bg-border bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-bg-card">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/40">Analyse</p>
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-700 dark:text-white/80">{data.explanation}</p>
                      </div>
                    )}

                    <p className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/40">
                      {data.results.length} produit{data.results.length > 1 ? "s" : ""} · triés du moins cher au plus cher
                    </p>

                    {(() => {
                      const total = data.results.length;
                      const totalPages = Math.ceil(total / PAGE_SIZE);
                      const start = page * PAGE_SIZE;
                      const pageItems = data.results.slice(start, start + PAGE_SIZE);
                      const goTo = (p: number) => {
                        setPage(p);
                        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      };
                      return (
                        <>
                          {/* Cartes produits — grandes, empilées (lisibles dans la fenêtre) */}
                          <div ref={resultsRef} className="grid grid-cols-1 gap-3.5">
                            {pageItems.map((group, gi) => {
                              const isGlobalCheapest =
                                globalCheapest !== null && !group.is_accessory && group.min_price === globalCheapest;
                              const multiShop = group.offers.length > 1;
                              const cheapestOffer = group.offers[0];
                              // "Moins cher ici" seulement si la 1ère offre est STRICTEMENT
                              // moins chère que la 2e (sinon prix égaux → pas de gagnant)
                              const hasPriceAdvantage =
                                multiShop && group.offers[1] && group.offers[0].price < group.offers[1].price;
                              return (
                                <div
                                  key={start + gi}
                                  className={`group/card llm-card relative flex flex-col overflow-hidden rounded-2xl border bg-bg-card shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-12px_rgba(0,0,0,0.28)] ${
                                    isGlobalCheapest
                                      ? "border-emerald-400/60 ring-1 ring-emerald-300/60 dark:border-emerald-500/40 dark:ring-emerald-500/20"
                                      : "border-bg-border hover:border-brand-gold/40 dark:hover:border-brand-gold/30"
                                  }`}
                                  style={{ animationDelay: `${gi * 60}ms` }}
                                >
                                  {/* reflet qui glisse au survol */}
                                  <span aria-hidden className="llm-shine" />

                                  {/* En-tête produit : GRANDE image + titre + prix */}
                                  <div
                                    className={`flex items-center gap-4 px-4 py-4 sm:px-5 ${
                                      isGlobalCheapest ? "bg-emerald-50/60 dark:bg-emerald-500/10" : "bg-slate-50/60 dark:bg-white/[0.02]"
                                    }`}
                                  >
                                    {/* Image produit — plus grande */}
                                    <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-bg-border bg-gradient-to-br from-slate-50 to-slate-100 dark:border-white/10 dark:from-bg-700 dark:to-bg-800 sm:h-32 sm:w-32">
                                      {group.image ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={group.image}
                                          alt={group.title}
                                          loading="lazy"
                                          className="h-full w-full object-contain p-2.5 transition-transform duration-500 group-hover/card:scale-110"
                                          onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).style.display = "none";
                                          }}
                                        />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-white/20">
                                          <Store className="h-10 w-10" />
                                        </div>
                                      )}
                                      {isGlobalCheapest && (
                                        <span className="absolute left-0 top-0 rounded-br-xl bg-emerald-500 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
                                          ★ Top prix
                                        </span>
                                      )}
                                    </div>

                                    {/* Titre + dispo + prix */}
                                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                      <p className="line-clamp-3 text-base font-bold leading-snug text-slate-900 dark:text-white">
                                        {group.title}
                                      </p>
                                      <div className="flex items-center gap-1.5">
                                        <Store className="h-3.5 w-3.5 text-brand-red" />
                                        <span className="text-xs font-medium text-slate-500 dark:text-white/50">
                                          {multiShop ? `Disponible dans ${group.offers.length} boutiques` : "1 boutique"}
                                        </span>
                                      </div>
                                      <div className="mt-1 flex items-baseline gap-1.5">
                                        <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-white/40">dès</span>
                                        <span
                                          className={`text-2xl font-black leading-none tabular-nums sm:text-3xl ${
                                            isGlobalCheapest ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"
                                          }`}
                                        >
                                          {group.min_price.toLocaleString("fr-FR")}
                                          <span className="text-sm font-bold"> DT</span>
                                        </span>
                                      </div>
                                      {cheapestOffer && (
                                        <span className="text-xs text-slate-400 dark:text-white/40">
                                          chez <span className="font-semibold text-slate-500 dark:text-white/60">{cheapestOffer.shop_name}</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Offres par boutique */}
                                  <div className="mt-auto">
                                    {group.offers.map((o, oi) => {
                                      const stock = STOCK_LABEL[o.stock_status] || STOCK_LABEL.inconnu;
                                      const isBest = oi === 0;
                                      return (
                                        <a
                                          key={oi}
                                          href={o.url || "#"}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-t border-bg-border px-4 py-3 text-sm transition hover:bg-brand-gold/5 dark:border-white/5 sm:px-5"
                                        >
                                          <div className="flex min-w-0 items-center gap-1.5">
                                            <Store className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-white/40" />
                                            <span className="truncate font-semibold text-slate-900 dark:text-white">{o.shop_name}</span>
                                            {isBest && hasPriceAdvantage && (
                                              <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                                                Moins cher ici
                                              </span>
                                            )}
                                          </div>
                                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${stock.cls}`}>
                                            {stock.label}
                                          </span>
                                          <div className="flex items-center justify-end gap-1 text-right">
                                            <span className={`font-bold tabular-nums ${isBest ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-white/80"}`}>
                                              {o.price.toLocaleString("fr-FR")} DT
                                            </span>
                                            <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover/card:translate-x-0.5 dark:text-white/30" />
                                          </div>
                                        </a>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Pagination */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-1.5 pt-3">
                              <button
                                onClick={() => goTo(Math.max(0, page - 1))}
                                disabled={page === 0}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-bg-border bg-bg-card text-slate-500 transition hover:border-brand-gold/50 hover:text-brand-goldDark disabled:cursor-not-allowed disabled:opacity-30 dark:text-white/60 dark:hover:text-brand-gold"
                                aria-label="Page précédente"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              {Array.from({ length: totalPages }).map((_, p) => (
                                <button
                                  key={p}
                                  onClick={() => goTo(p)}
                                  className={`h-9 min-w-9 rounded-xl px-3 text-sm font-bold tabular-nums transition ${
                                    p === page
                                      ? "bg-brand-gold text-black shadow-sm"
                                      : "border border-bg-border bg-bg-card text-slate-500 hover:border-brand-gold/50 hover:text-brand-goldDark dark:text-white/60 dark:hover:text-brand-gold"
                                  }`}
                                >
                                  {p + 1}
                                </button>
                              ))}
                              <button
                                onClick={() => goTo(Math.min(totalPages - 1, page + 1))}
                                disabled={page === totalPages - 1}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-bg-border bg-bg-card text-slate-500 transition hover:border-brand-gold/50 hover:text-brand-goldDark disabled:cursor-not-allowed disabled:opacity-30 dark:text-white/60 dark:hover:text-brand-gold"
                                aria-label="Page suivante"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}

                  </>
                )}
              </div>
            </div>
          )}
            </div>

            {/* Barre de recherche (suivi) */}
            <div className="shrink-0 border-t border-bg-border bg-bg-card px-4 py-3.5 dark:border-white/10 sm:px-6">
              <form onSubmit={handleSearch}>
                <div
                  className={`group flex items-center gap-2 rounded-2xl border p-1.5 transition-all duration-300 ${
                    focused
                      ? "border-brand-gold/50 bg-white shadow-[0_0_0_3px_rgba(246,196,83,0.15)] dark:border-brand-gold/40 dark:bg-bg-900 dark:shadow-[0_0_0_3px_rgba(246,196,83,0.12)]"
                      : "border-slate-300 bg-slate-50 shadow-sm hover:border-brand-gold/40 dark:border-bg-border dark:bg-bg-900 dark:shadow-none dark:hover:border-brand-gold/30"
                  }`}
                >
                  <Search className={`ml-1 h-5 w-5 shrink-0 transition-colors ${focused ? "text-brand-gold" : "text-slate-400 dark:text-white/40"}`} />
                  <input
                    ref={modalInputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="Nouvelle requête produit…"
                    className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white dark:placeholder:text-white/35"
                  />
                  <button
                    type="submit"
                    disabled={loading || !query.trim()}
                    className="btn-gold shrink-0 whitespace-nowrap px-4 py-2 text-sm shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="hidden sm:inline">Analyse…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>Analyser</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
