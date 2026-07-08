"use client";

import { useState } from "react";

// Brand logo tile with graceful fallback to initials when the favicon
// service has nothing for the domain (or the brand has no known domain).
export function ClimBrandBadge({
  label,
  logo,
  count,
}: {
  label: string;
  logo: string | null;
  count: number;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 transition hover:border-sky-400/50 hover:shadow-sm dark:border-white/[0.07] dark:bg-white/[0.03]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 dark:ring-white/10">
        {logo && !broken ? (
          <img
            src={logo}
            alt={label}
            className="h-7 w-7 object-contain"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="text-xs font-black text-slate-500">{label.slice(0, 2).toUpperCase()}</span>
        )}
      </span>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-bold text-slate-900 dark:text-white">{label}</div>
        <div className="text-[11px] tabular-nums text-slate-400 dark:text-white/45">
          {count} modèle{count > 1 ? "s" : ""} en stock
        </div>
      </div>
    </div>
  );
}
