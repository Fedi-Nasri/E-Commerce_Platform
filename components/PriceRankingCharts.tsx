"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { isInsufficientSample, shopDisplayName } from "@/lib/priceRankings";
import type { RankedShopRow } from "@/lib/priceRankingsServer";

type TierPoint = {
  key: string;
  label: string;
  leader: string;
  ecart_pct: number;
  indice: number;
  produits: number;
};

function shortShop(key: string) {
  const n = shopDisplayName(key);
  return n.length > 12 ? `${n.slice(0, 11)}…` : n;
}

function fmtPct(v: number) {
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-bg-border bg-bg-card p-4 sm:p-5 dark:border-white/[0.08]">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
      {subtitle && (
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-white/50">
          {subtitle}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function EcartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { shop: string; ecart: number; indice: number } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-bg-border bg-bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
      <div className="font-bold text-slate-900 dark:text-white">{shopDisplayName(d.shop)}</div>
      <div className="mt-1 text-slate-600 dark:text-white/70">Écart vs marché : <strong>{fmtPct(d.ecart)}</strong></div>
      <div className="text-slate-600 dark:text-white/70">Indice ajusté : <strong>{d.indice.toFixed(3)}</strong></div>
    </div>
  );
}

export function PriceRankingCharts({
  shops,
  paliers,
}: {
  shops: RankedShopRow[];
  paliers?: Array<{
    key: string;
    label: string;
    classement: Array<{ shop: string; ecart_pct: number; indice_ajuste: number; produits_compares: number }>;
  }>;
}) {
  const reliable = shops
    .filter((s) => !isInsufficientSample(s) && (s.products_compared ?? 0) >= 20)
    .slice(0, 12);

  const ecartData = reliable.map((s) => ({
    shop: s.shop_key,
    label: shortShop(s.shop_key),
    ecart: Number(s.ecart_pct ?? s.avg_extra_cost_vs_cheapest ?? 0),
    indice: Number(s.robust_index ?? s.cheapest_score ?? 1),
  }));

  const curveData = shops.slice(0, 20).map((s, i) => ({
    rank: i + 1,
    indice: Number(s.robust_index ?? s.cheapest_score ?? 1),
    shop: shortShop(s.shop_key),
  }));

  const tierData: TierPoint[] = (paliers ?? [])
    .filter((p) => p.classement?.length)
    .map((p) => {
      const leader = p.classement[0];
      return {
        key: p.key,
        label: p.label.replace(/ produits.*/, "").replace("≥ ", "≥"),
        leader: leader.shop,
        ecart_pct: leader.ecart_pct,
        indice: leader.indice_ajuste,
        produits: leader.produits_compares,
      };
    });

  const scatterData = reliable
    .filter((s) => s.win_rate_pct != null && s.ecart_pct != null)
    .map((s) => ({
      shop: shortShop(s.shop_key),
      x: Number(s.ecart_pct),
      y: Number(s.win_rate_pct),
      z: Number(s.products_compared ?? 10),
    }));

  if (!ecartData.length && !tierData.length) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {ecartData.length > 0 && (
        <ChartCard
          title="Écart prix vs marché (enseignes fiables)"
          subtitle="Indice shrinkage : négatif = moins cher que la médiane du marché sur les produits comparés."
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ecartData} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="label" width={88} tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip cursor={{ fill: "rgba(246,196,83,0.08)" }} content={<EcartTooltip />} />
              <Bar dataKey="ecart" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={700}>
                {ecartData.map((d, i) => (
                  <Cell key={i} fill={d.ecart <= 0 ? "#10b981" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {curveData.length > 1 && (
        <ChartCard
          title="Courbe d'indice ajusté"
          subtitle="Classement complet : plus l'indice est bas, plus l'enseigne est compétitive."
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={curveData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="rank" tick={{ fontSize: 10, fill: "#94a3b8" }} label={{ value: "Rang", position: "insideBottom", offset: -2, fontSize: 10 }} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#94a3b8" }} width={42} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as { shop: string; indice: number; rank: number };
                  return (
                    <div className="rounded-lg border border-bg-border bg-bg-card/95 px-3 py-2 text-xs shadow-lg">
                      <div className="font-bold">{d.shop}</div>
                      <div>Rang {d.rank} · indice {d.indice.toFixed(3)}</div>
                    </div>
                  );
                }}
              />
              <Line type="monotone" dataKey="indice" stroke="#f6c453" strokeWidth={2.5} dot={{ r: 3, fill: "#f6c453" }} animationDuration={900} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {tierData.length > 0 && (
        <ChartCard
          title="Leader par palier de volume"
          subtitle="Chaque palier compare des enseignes de taille catalogue similaire."
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={tierData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8" }} angle={-18} textAnchor="end" height={56} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `${v}%`} width={40} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as TierPoint;
                  return (
                    <div className="rounded-lg border border-bg-border bg-bg-card/95 px-3 py-2 text-xs shadow-lg">
                      <div className="font-bold">{d.label}</div>
                      <div>{shopDisplayName(d.leader)}</div>
                      <div>Écart {fmtPct(d.ecart_pct)} · {d.produits} produits</div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="ecart_pct" radius={[6, 6, 2, 2]} isAnimationActive animationDuration={800}>
                {tierData.map((d, i) => (
                  <Cell key={i} fill={d.ecart_pct <= 0 ? "#176b87" : "#f59e0b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {scatterData.length >= 3 && (
        <ChartCard
          title="Win-rate vs écart (fiabilité)"
          subtitle="Concordance entre taux de victoire classique et indice shrinkage."
        >
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis type="number" dataKey="x" name="Écart %" tick={{ fontSize: 10, fill: "#94a3b8" }} unit="%" />
              <YAxis type="number" dataKey="y" name="Win-rate" tick={{ fontSize: 10, fill: "#94a3b8" }} unit="%" domain={[0, 100]} />
              <ZAxis type="number" dataKey="z" range={[40, 400]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as { shop: string; x: number; y: number; z: number };
                  return (
                    <div className="rounded-lg border border-bg-border bg-bg-card/95 px-3 py-2 text-xs shadow-lg">
                      <div className="font-bold">{d.shop}</div>
                      <div>Écart {fmtPct(d.x)} · win-rate {d.y.toFixed(0)}%</div>
                      <div>{d.z} produits</div>
                    </div>
                  );
                }}
              />
              <Scatter data={scatterData} fill="#f6c453" animationDuration={900} />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}
