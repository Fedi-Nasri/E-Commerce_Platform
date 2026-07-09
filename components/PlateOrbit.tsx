"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { StrictPlateReport } from "@/lib/popularPlates";
import { fmtDt } from "@/lib/popularPlates";

const CARD = 78;
const PADDING = 6;
const STAGE_HEIGHT = 360;
const ROTATE_MS = 9000;
const FADE_MS = 380;

type Props = {
  plates: StrictPlateReport[];
};

function orbitLabel(name: string): string {
  if (name === "Tomate/concentre") return "Tomate";
  if (name === "Oeufs") return "Œufs";
  return name;
}

function plateKicker(title: string): string {
  if (title.toLowerCase().includes("ojja")) return "Ojja";
  if (title.toLowerCase().includes("makrouna")) return "Makrouna";
  return title.split(" ")[0] ?? title;
}

export function PlateOrbit({ plates }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [width, setWidth] = useState(360);
  const [paused, setPaused] = useState(false);
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  const plate = plates[index] ?? plates[0];
  const ingredients = plate?.orbitIngredients ?? [];

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = e.contentRect.width;
        if (w > 0) setWidth(Math.round(w));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
  }, []);

  const switchTo = useCallback(
    (next: number) => {
      if (plates.length <= 1 || next === index || fading) return;
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      setFading(true);
      fadeTimer.current = setTimeout(() => {
        setIndex(next);
        requestAnimationFrame(() => setFading(false));
      }, FADE_MS);
    },
    [fading, index, plates.length],
  );

  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => {
    if (plates.length <= 1 || paused) return;
    const id = window.setInterval(() => {
      const next = (indexRef.current + 1) % plates.length;
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      setFading(true);
      fadeTimer.current = setTimeout(() => {
        setIndex(next);
        requestAnimationFrame(() => setFading(false));
      }, FADE_MS);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [plates.length, paused]);

  if (!plate) return null;

  const count = Math.max(ingredients.length, 1);
  const card = width < 320 ? 60 : width < 420 ? 68 : CARD;
  const height = width < 320 ? 300 : width < 420 ? 330 : STAGE_HEIGHT;
  const halfW = width / 2;
  const halfH = height / 2;
  const radius = Math.max(0, Math.min(halfW, halfH) - card / 2 - PADDING);
  const ring = 2 * radius + card;
  const center = ring / 2;
  const spinPaused = paused || fading;
  const fadeClass = fading ? "plate-orbit-fade--out" : "plate-orbit-fade--in";

  return (
    <div className="plate-orbit-wrap">
      <div
        ref={stageRef}
        className="ojja-stage plate-orbit-root"
        style={{ height }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Badge, guide, plate — same stacking as OjjaOrbit (cost z-index 6 above spinner) */}
        <div className={`ojja-center-cost ${fadeClass}`}>
          <span className="ojja-center-cost-kicker">{plateKicker(plate.title)}</span>
          <strong>{fmtDt(plate.featuredConsumedTotal)} DT</strong>
          <span className="ojja-center-cost-shop">
            {plate.featuredShop} · identiques
          </span>
        </div>

        <div
          className={`ojja-orbit-guide ${fadeClass}`}
          style={{ width: 2 * radius, height: 2 * radius }}
        />

        <div className={`ojja-center-plate ${fadeClass}`}>
          <div className="ojja-plate-halo" />
          <img src={plate.image} alt={plate.title} className="ojja-plate-img" />
        </div>

        {/* Spinner remounts per plate so ring + counter-rotation stay in sync */}
        <div
          key={plate.id}
          className={`ojja-spinner plate-orbit-spinner ${fadeClass}`}
          style={{
            width: ring,
            height: ring,
            animationPlayState: spinPaused ? "paused" : "running",
          }}
        >
          {ingredients.map((ing, i) => {
            const angle = (2 * Math.PI * i) / count - Math.PI / 2;
            const x = center + radius * Math.cos(angle) - card / 2;
            const y = center + radius * Math.sin(angle) - card / 2;
            return (
              <div
                key={ing.name}
                className="ojja-card-slot"
                style={{ left: x, top: y, width: card, height: card }}
              >
                <div
                  className="ojja-card-counter"
                  style={{ animationPlayState: spinPaused ? "paused" : "running" }}
                >
                  <div
                    className="ojja-card"
                    style={{ ["--accent" as string]: ing.accent }}
                  >
                    <div className="ojja-card-icon">
                      <img src={ing.icon} alt="" width={20} height={20} />
                    </div>
                    <div className="ojja-card-name">{orbitLabel(ing.name)}</div>
                    <div className="ojja-card-qty">{ing.qty}</div>
                    <div
                      className="ojja-card-price"
                      title={`Prix catalogue : ${ing.price} DT`}
                    >
                      {ing.portionPrice} DT
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {plates.length > 1 && (
        <div className="mt-3 flex items-center justify-center">
          <div className="inline-flex rounded-full border border-slate-200/80 bg-white/90 p-1 shadow-sm dark:border-white/12 dark:bg-white/[0.06]">
            {plates.map((p, i) => {
              const active = i === index;
              const short =
                p.title.toLowerCase().includes("makrouna")
                  ? "Makrouna"
                  : p.title.toLowerCase().includes("ojja")
                    ? "Ojja"
                    : p.title;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-label={p.title}
                  aria-current={active ? "true" : undefined}
                  onClick={() => switchTo(i)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-all duration-300 ${
                    active
                      ? "bg-brand-gold text-slate-950 shadow-[0_4px_14px_-6px_rgba(246,196,83,0.8)]"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-white/60 dark:hover:bg-white/[0.1] dark:hover:text-white"
                  }`}
                >
                  {short}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-2 text-center text-[10px] text-slate-400 dark:text-white/40">
        <span className="font-medium text-slate-500 dark:text-white/55">{plate.title}</span>
        {" · "}
        <Link
          href={`/qoffa/plats/${plate.slug}`}
          className="font-semibold text-brand-gold hover:underline"
        >
          Voir le détail
        </Link>
      </p>
    </div>
  );
}
