"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type BtuStatRow = { btu: string; count: number; minPrice: number };

const BTU_LABELS: Record<string, string> = {
  "9000": "Petites pièces",
  "12000": "Chambres",
  "18000": "Salons",
  "24000": "Grands espaces",
};

const fmt = (n: number) => n.toLocaleString("fr-FR");
const BAR_COLORS = ["#38bdf8", "#0ea5e9", "#0284c7", "#0369a1", "#7dd3fc", "#22d3ee", "#06b6d4"];

type ChartPoint = {
  btu: number;
  label: string;
  room: string;
  count: number;
  minPrice: number;
};

function toChartData(rows: BtuStatRow[]): ChartPoint[] {
  return rows
    .map((row) => ({
      btu: Number(row.btu),
      label: `${fmt(Number(row.btu))} BTU`,
      room: BTU_LABELS[row.btu] ?? "",
      count: row.count,
      minPrice: row.minPrice,
    }))
    .sort((a, b) => a.btu - b.btu);
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-white/[0.07] dark:bg-[#0d1220]">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
      {subtitle && (
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-white/50">{subtitle}</p>
      )}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function PriceTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-bg-border bg-bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
      <div className="font-bold text-slate-900 dark:text-white">{d.label}</div>
      {d.room && <div className="text-slate-500 dark:text-white/50">{d.room}</div>}
      <div className="mt-1.5 flex items-center justify-between gap-4 text-slate-600 dark:text-white/70">
        <span>Prix minimum</span>
        <span className="font-black tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(d.minPrice)} DT</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-slate-600 dark:text-white/70">
        <span>Modèles</span>
        <span className="font-bold tabular-nums text-sky-600 dark:text-sky-300">{d.count}</span>
      </div>
    </div>
  );
}

function CountTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-bg-border bg-bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
      <div className="font-bold text-slate-900 dark:text-white">{d.label}</div>
      {d.room && <div className="text-slate-500 dark:text-white/50">{d.room}</div>}
      <div className="mt-1.5 flex items-center justify-between gap-4 text-slate-600 dark:text-white/70">
        <span>Modèles en stock</span>
        <span className="font-black tabular-nums text-sky-600 dark:text-sky-300">{d.count}</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-slate-600 dark:text-white/70">
        <span>Dès</span>
        <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(d.minPrice)} DT</span>
      </div>
    </div>
  );
}

export function ClimBrandBtuCharts({ byBtu }: { byBtu: BtuStatRow[] }) {
  const data = toChartData(byBtu);
  if (!data.length) return null;

  const tickFill = "#8a93ab";
  const gridStroke = "rgba(148,163,184,0.2)";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title="Courbe des prix minimums"
        subtitle="Évolution du prix d'entrée par capacité BTU — plus la courbe monte, plus la puissance coûte cher."
      >
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="climBtuPriceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="btu"
                tick={{ fill: tickFill, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
              />
              <YAxis
                tick={{ fill: tickFill, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={52}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                domain={[(min: number) => Math.floor(min * 0.92), (max: number) => Math.ceil(max * 1.06)]}
              />
              <Tooltip content={<PriceTooltip />} cursor={{ stroke: "rgba(16,185,129,0.25)", strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="minPrice"
                stroke="#10b981"
                strokeWidth={2.5}
                fill="url(#climBtuPriceFill)"
                dot={{ r: 4, fill: "#10b981", stroke: "#0d1220", strokeWidth: 2 }}
                activeDot={{ r: 6, stroke: "#10b981", fill: "#0d1220", strokeWidth: 2 }}
                isAnimationActive
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="Répartition par capacité"
        subtitle="Nombre de modèles disponibles pour chaque palier BTU sur le marché."
      >
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="btu"
                tick={{ fill: tickFill, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
              />
              <YAxis
                tick={{ fill: tickFill, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={36}
                allowDecimals={false}
              />
              <Tooltip content={<CountTooltip />} cursor={{ fill: "rgba(56,189,248,0.08)" }} />
              <Bar dataKey="count" radius={[6, 6, 2, 2]} maxBarSize={44} isAnimationActive animationDuration={700}>
                {data.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
