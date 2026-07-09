"use client";

import { useEffect, useMemo, useState } from "react";
import { localShopLogo } from "@/lib/shopLogos";

const INITIALS_COLORS: Record<string, string> = {
  a: "bg-slate-600", b: "bg-slate-700", c: "bg-zinc-600", d: "bg-neutral-600",
  e: "bg-stone-600", f: "bg-slate-600", g: "bg-zinc-700", h: "bg-neutral-700",
  i: "bg-stone-700", j: "bg-slate-500", k: "bg-zinc-500", l: "bg-neutral-500",
  m: "bg-stone-500", n: "bg-slate-600", o: "bg-zinc-600", p: "bg-neutral-600",
  q: "bg-stone-600", r: "bg-slate-700", s: "bg-zinc-700", t: "bg-neutral-700",
  u: "bg-stone-700", v: "bg-slate-500", w: "bg-zinc-500", x: "bg-neutral-500",
  y: "bg-stone-500", z: "bg-slate-600",
};

function initialsColor(key: string) {
  return INITIALS_COLORS[key[0]?.toLowerCase() ?? "a"] ?? "bg-slate-600";
}

function buildFallbacks(shopKey: string): string[] {
  const mapped = localShopLogo(shopKey, shopKey);
  const exts = ["svg", "png", "webp", "jpg", "jpeg"] as const;
  const guessed = exts.map((ext) => `/shop-logos/${shopKey}.${ext}`);
  if (mapped) return [mapped, ...guessed.filter((p) => p !== mapped)];
  return guessed;
}

export function ShopLogo({
  shopKey,
  size = 48,
  className = "",
  interactive = false,
}: {
  shopKey: string;
  size?: number;
  className?: string;
  /** Scale + lift on hover */
  interactive?: boolean;
}) {
  const fallbacks = useMemo(() => buildFallbacks(shopKey), [shopKey]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [shopKey, fallbacks]);

  const shellClass = [
    "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/90",
    "bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300/90 shadow-sm",
    "dark:border-slate-200/20 dark:from-slate-600 dark:via-slate-500 dark:to-slate-700 dark:shadow-md dark:shadow-black/20",
    interactive
      ? "cursor-pointer transition-all duration-300 ease-out hover:scale-[1.12] hover:-translate-y-1.5 hover:shadow-lg hover:shadow-black/30 hover:ring-2 hover:ring-brand-gold/45 active:scale-105"
      : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const pad = Math.max(4, Math.round(size * 0.1));
  const imgSize = size - pad * 2;

  if (idx >= fallbacks.length) {
    const initials = shopKey
      .replace(/[_-]/g, " ")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");
    return (
      <div style={{ width: size, height: size }} className={shellClass}>
        <span
          className={`flex h-full w-full items-center justify-center rounded-[10px] text-[11px] font-bold tracking-wide text-white ${initialsColor(shopKey)}`}
        >
          {initials}
        </span>
      </div>
    );
  }

  return (
    <div style={{ width: size, height: size, padding: pad }} className={shellClass}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[2px] rounded-[10px] ring-1 ring-black/[0.12] dark:ring-white/[0.12]"
      />
      <img
        key={`${shopKey}-${idx}`}
        src={fallbacks[idx]}
        alt=""
        onError={() => setIdx((i) => i + 1)}
        referrerPolicy="no-referrer"
        style={{ width: imgSize, height: imgSize }}
        className="relative z-[1] object-contain contrast-[1.24] saturate-[1.14] drop-shadow-[0_1px_2px_rgba(15,23,42,0.55)]"
      />
    </div>
  );
}
