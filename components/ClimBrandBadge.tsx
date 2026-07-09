"use client";

import Link from "next/link";
import { useState } from "react";

export function ClimBrandBadge({
  label,
  logo,
  count,
  href,
}: {
  label: string;
  logo: string | null;
  count: number;
  href?: string;
}) {
  const [broken, setBroken] = useState(false);
  const inner = (
    <>
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300/90 shadow-sm dark:border-slate-200/25 dark:from-slate-600 dark:via-slate-500 dark:to-slate-700">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[2px] rounded-[10px] ring-1 ring-black/[0.12] dark:ring-white/[0.14]"
        />
        {logo && !broken ? (
          <img
            src={logo}
            alt={label}
            className="relative z-[1] h-8 w-8 object-contain contrast-[1.22] saturate-[1.14] drop-shadow-[0_1px_2px_rgba(15,23,42,0.55)]"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="relative z-[1] text-xs font-black text-slate-600 dark:text-slate-100">
            {label.slice(0, 2).toUpperCase()}
          </span>
        )}
      </span>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-bold text-slate-900 dark:text-white">{label}</div>
        <div className="text-[11px] tabular-nums text-slate-400 dark:text-white/45">
          {count} modèle{count > 1 ? "s" : ""} en stock
        </div>
      </div>
    </>
  );

  const className =
    "flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 transition hover:border-sky-400/50 hover:shadow-sm dark:border-white/[0.07] dark:bg-white/[0.03] dark:hover:border-sky-400/35";

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
