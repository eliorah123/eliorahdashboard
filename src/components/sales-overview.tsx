"use client";

import { useState, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeMetrics, type DailyEntry } from "@/types/daily-entry";
import {
  entryRepository,
  goalStorage,
  sellerRepository,
} from "@/lib/storage";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Period    = "7d" | "30d" | "month" | "90d";
type MetricKey = "revenue" | "investment" | "roas" | "cpl" | "conversion";

interface PeriodRange { from: string; to: string; }

interface DayAgg {
  investment: number;
  leads:      number;
  sales:      number;
  revenue:    number;
}

interface ChartPoint {
  label:    string;
  current:  number;
  previous: number;
}

interface Totals {
  investment:     number;
  leads:          number;
  sales:          number;
  revenue:        number;
  roas:           number;
  cpl:            number;
  conversionRate: number;
  avgTicket:      number;
  profit:         number;
}

interface SellerRow {
  id:        string;
  name:      string;
  revenue:   number;
  sales:     number;
  avgTicket: number;
  share:     number;
}

interface InsightItem {
  label:     string;
  value:     string;
  direction: "up" | "down" | "neutral";
  positive:  boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const SHORT_MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const WEEKDAYS     = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
const CHART_COLOR  = "#1a9e62";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toISO(d: Date): string { return d.toISOString().split("T")[0]; }

function shiftDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function formatBRL(v: number): string {
  if (v === 0) return "R$ 0";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(1)}k`;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function formatPct(v: number):  string { return v > 0 ? `${v.toFixed(1)}%` : "0%"; }
function formatROAS(v: number): string { return v > 0 ? `${v.toFixed(2)}x` : "0x"; }

function getPeriodRange(period: Period): PeriodRange {
  const today = new Date();
  if (period === "7d")    return { from: toISO(shiftDays(today, -6)),  to: toISO(today) };
  if (period === "30d")   return { from: toISO(shiftDays(today, -29)), to: toISO(today) };
  if (period === "90d")   return { from: toISO(shiftDays(today, -89)), to: toISO(today) };
  const y = today.getFullYear(), m = today.getMonth() + 1;
  return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: toISO(today) };
}

function getPreviousRange(from: string, to: string): PeriodRange {
  const f    = new Date(from + "T12:00:00");
  const t    = new Date(to   + "T12:00:00");
  const days = Math.round((t.getTime() - f.getTime()) / 86_400_000) + 1;
  return { from: toISO(shiftDays(f, -days)), to: toISO(shiftDays(f, -1)) };
}

function aggregateRange(entries: DailyEntry[], from: string, to: string): Map<string, DayAgg> {
  const byDate = new Map<string, DayAgg>();
  for (const e of entries) {
    if (e.date < from || e.date > to) continue;
    const p = byDate.get(e.date) ?? { investment: 0, leads: 0, sales: 0, revenue: 0 };
    byDate.set(e.date, {
      investment: p.investment + e.investment,
      leads:      p.leads      + e.leads,
      sales:      p.sales      + e.sales,
      revenue:    p.revenue    + e.revenue,
    });
  }
  return byDate;
}

function sumMap(map: Map<string, DayAgg>): DayAgg {
  return Array.from(map.values()).reduce(
    (acc, d) => ({
      investment: acc.investment + d.investment,
      leads:      acc.leads      + d.leads,
      sales:      acc.sales      + d.sales,
      revenue:    acc.revenue    + d.revenue,
    }),
    { investment: 0, leads: 0, sales: 0, revenue: 0 },
  );
}

function computeTotals(entries: DailyEntry[], from: string, to: string): Totals {
  const agg = sumMap(aggregateRange(entries, from, to));
  const m   = computeMetrics(agg.investment, agg.leads, agg.sales, agg.revenue);
  return { ...agg, ...m };
}

function getMetricValue(key: MetricKey, agg: DayAgg): number {
  const m = computeMetrics(agg.investment, agg.leads, agg.sales, agg.revenue);
  switch (key) {
    case "revenue":    return agg.revenue;
    case "investment": return agg.investment;
    case "roas":       return m.roas;
    case "cpl":        return m.cpl;
    case "conversion": return m.conversionRate;
  }
}

function getTotalForMetric(t: Totals, key: MetricKey): number {
  switch (key) {
    case "revenue":    return t.revenue;
    case "investment": return t.investment;
    case "roas":       return t.roas;
    case "cpl":        return t.cpl;
    case "conversion": return t.conversionRate;
  }
}

function buildChartData(
  entries: DailyEntry[],
  from: string,
  to: string,
  metric: MetricKey,
): ChartPoint[] {
  const prev      = getPreviousRange(from, to);
  const currMap   = aggregateRange(entries, from, to);
  const prevMap   = aggregateRange(entries, prev.from, prev.to);
  const start     = new Date(from + "T12:00:00");
  const end       = new Date(to   + "T12:00:00");
  const days      = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const prevStart = new Date(prev.from + "T12:00:00");
  const ZERO      = { investment: 0, leads: 0, sales: 0, revenue: 0 };

  const fmt = (iso: string) => {
    const [, m, d] = iso.split("-").map(Number);
    return days > 30
      ? `${String(d).padStart(2,"0")}/${SHORT_MONTHS[m - 1]}`
      : `${d} ${SHORT_MONTHS[m - 1]}`;
  };

  return Array.from({ length: days }, (_, i) => {
    const curDate  = toISO(shiftDays(start,     i));
    const prevDate = toISO(shiftDays(prevStart, i));
    return {
      label:    fmt(curDate),
      current:  getMetricValue(metric, currMap.get(curDate)  ?? ZERO),
      previous: getMetricValue(metric, prevMap.get(prevDate) ?? ZERO),
    };
  });
}

// ─── InsightPill ───────────────────────────────────────────────────────────────

function InsightPill({ label, value, direction, positive }: InsightItem) {
  const isGood = direction === "neutral"
    ? null
    : direction === "up" ? positive : !positive;
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border flex-shrink-0",
      isGood === true  && "bg-green-50 border-green-100 text-green-700",
      isGood === false && "bg-red-50/70 border-red-100 text-red-500",
      isGood === null  && "bg-gray-50 border-gray-100 text-gray-500",
    )}>
      <Icon size={11} strokeWidth={2.5} />
      <span className="text-gray-400">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

// ─── KPI Group ─────────────────────────────────────────────────────────────────

function KpiItem({ label, value, highlight }: {
  label: string; value: string; highlight?: "green" | "red" | null;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={cn(
        "text-xl font-bold leading-none tracking-tight",
        highlight === "green" && "text-green-600",
        highlight === "red"   && "text-red-400",
        !highlight             && "text-gray-900",
      )}>{value}</p>
    </div>
  );
}

function KpiGroup({ title, accent, children }: { title: string; accent: string; children: ReactNode }) {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100/80 p-5"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className={cn("w-0.5 h-4 rounded-full", accent)} />
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</p>
      </div>
      <div className="grid grid-cols-3 gap-4">{children}</div>
    </div>
  );
}

// ─── Chart Tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({
  active, payload, label, metricLabel, valueFmt,
}: {
  active?:     boolean;
  payload?:    Array<{ value?: number; dataKey?: string }>;
  label?:      string;
  metricLabel: string;
  valueFmt:    (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const cur  = payload.find(p => p.dataKey === "current");
  const prev = payload.find(p => p.dataKey === "previous");
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-3.5 py-3 shadow-lg min-w-[160px]">
      <p className="text-[10px] text-gray-400 mb-2 font-semibold">{label}</p>
      {cur && (
        <div className="flex items-center justify-between gap-6 mb-1">
          <span className="text-[10px] text-gray-500">Atual</span>
          <span className="text-sm font-bold text-gray-900">{valueFmt(cur.value ?? 0)}</span>
        </div>
      )}
      {prev && (prev.value ?? 0) > 0 && (
        <div className="flex items-center justify-between gap-6">
          <span className="text-[10px] text-gray-400">Anterior</span>
          <span className="text-xs font-semibold text-gray-400">{valueFmt(prev.value ?? 0)}</span>
        </div>
      )}
      <p className="text-[10px] text-gray-300 mt-2 pt-1.5 border-t border-gray-50">{metricLabel}</p>
    </div>
  );
}

// ─── Heatmap Calendar ──────────────────────────────────────────────────────────

function HeatmapCalendar({ entries }: { entries: DailyEntry[] }) {
  const now      = new Date();
  const year     = now.getFullYear();
  const monthIdx = now.getMonth();
  const monthNum = monthIdx + 1;
  const daysInM  = new Date(year, monthNum, 0).getDate();
  const firstDay = new Date(year, monthIdx, 1).getDay();
  const offset   = (firstDay + 6) % 7; // Mon-start
  const todayStr = toISO(now);
  const fromStr  = `${year}-${String(monthNum).padStart(2,"0")}-01`;
  const toStr_   = `${year}-${String(monthNum).padStart(2,"0")}-${String(daysInM).padStart(2,"0")}`;

  const dayMap = useMemo(() => {
    const map = new Map<string, { roas: number; revenue: number }>();
    const agg = aggregateRange(entries, fromStr, toStr_);
    for (const [date, d] of agg.entries()) {
      const m = computeMetrics(d.investment, d.leads, d.sales, d.revenue);
      map.set(date, { roas: m.roas, revenue: d.revenue });
    }
    return map;
    // fromStr/toStr_ are stable (current month, won't change in a session)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  function cellStyle(dateStr: string) {
    const d = dayMap.get(dateStr);
    if (!d || d.revenue === 0) return { bg: "bg-gray-100",   text: "text-gray-300"   };
    if (d.roas >= 3)            return { bg: "bg-green-200",  text: "text-green-800"  };
    if (d.roas >= 1.5)          return { bg: "bg-amber-200",  text: "text-amber-800"  };
    return                             { bg: "bg-red-200",    text: "text-red-700"    };
  }

  const rows = Math.ceil((offset + daysInM) / 7);

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100/80 p-5"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">{SHORT_MONTHS[monthIdx]} {year}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Performance diária · baseada no ROAS</p>
        </div>
        <div className="flex items-center gap-3">
          {[
            { bg: "bg-green-200", label: "≥ 3x"  },
            { bg: "bg-amber-200", label: "1.5–3x" },
            { bg: "bg-red-200",   label: "< 1.5x" },
          ].map(({ bg, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={cn("w-2.5 h-2.5 rounded-sm", bg)} />
              <span className="text-[10px] text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-[10px] font-semibold text-gray-300 text-center py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: rows * 7 }, (_, i) => {
          const dayNum = i - offset + 1;
          if (dayNum < 1 || dayNum > daysInM) return <div key={i} />;
          const dateStr = `${year}-${String(monthNum).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`;
          const { bg, text } = cellStyle(dateStr);
          const d = dayMap.get(dateStr);
          return (
            <div
              key={i}
              title={d ? `ROAS ${d.roas.toFixed(2)}x · ${formatBRL(d.revenue)}` : undefined}
              className={cn(
                "flex items-center justify-center rounded-lg text-[11px] font-semibold aspect-square",
                bg, text,
                todayStr === dateStr && "ring-2 ring-gray-800 ring-offset-1",
              )}
            >
              {dayNum}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Seller Ranking ────────────────────────────────────────────────────────────

function SellerRankingList({ rows }: { rows: SellerRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-28 gap-2">
        <TrendingUp size={22} className="text-gray-200" strokeWidth={1.5} />
        <p className="text-xs text-gray-300">Sem dados no período</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3.5">
      {rows.map((s, i) => (
        <div key={s.id} className="flex items-center gap-3">
          <div className={cn(
            "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0",
            i === 0 && "bg-amber-100 text-amber-700",
            i === 1 && "bg-gray-100 text-gray-500",
            i === 2 && "bg-orange-50 text-orange-500",
            i  > 2 && "bg-gray-50 text-gray-300",
          )}>
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-semibold text-gray-800 truncate">{s.name}</span>
              <span className="text-xs font-bold text-gray-900 flex-shrink-0">{formatBRL(s.revenue)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(s.share, 100)}%`,
                    background: i === 0 ? `linear-gradient(90deg,${CHART_COLOR},#57d49c)` : "#CBD5E1",
                  }}
                />
              </div>
              <span className="text-[10px] text-gray-400 w-8 text-right flex-shrink-0">
                {s.share.toFixed(0)}%
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] text-gray-500">{s.sales} vendas</p>
            <p className="text-[10px] text-gray-400">{s.avgTicket > 0 ? formatBRL(s.avgTicket) : "—"}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Metric config ─────────────────────────────────────────────────────────────

const METRICS: { key: MetricKey; label: string; fmt: (v: number) => string; goodUp: boolean }[] = [
  { key: "revenue",    label: "Faturamento",  fmt: formatBRL,  goodUp: true  },
  { key: "investment", label: "Investimento", fmt: formatBRL,  goodUp: false },
  { key: "roas",       label: "ROAS",         fmt: formatROAS, goodUp: true  },
  { key: "cpl",        label: "CPL",          fmt: formatBRL,  goodUp: false },
  { key: "conversion", label: "Conversão",    fmt: formatPct,  goodUp: true  },
];

const PERIODS: { key: Period; label: string }[] = [
  { key: "7d",    label: "7 dias"    },
  { key: "30d",   label: "30 dias"   },
  { key: "month", label: "Mês atual" },
  { key: "90d",   label: "90 dias"   },
];

// ─── Main component ────────────────────────────────────────────────────────────

export function SalesOverview() {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [sellers, setSellers] = useState(() => sellerRepository.list());
  const [period,  setPeriod]  = useState<Period>("30d");
  const [metric,  setMetric]  = useState<MetricKey>("revenue");

  useEffect(() => {
    const load = () => {
      setEntries(entryRepository.list());
      setSellers(sellerRepository.list());
    };
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  const { from, to }   = useMemo(() => getPeriodRange(period), [period]);
  const prevRange      = useMemo(() => getPreviousRange(from, to), [from, to]);
  const totals         = useMemo(() => computeTotals(entries, from, to), [entries, from, to]);
  const prevTotals     = useMemo(() => computeTotals(entries, prevRange.from, prevRange.to), [entries, prevRange]);

  const goal = useMemo(() => {
    const now = new Date();
    return goalStorage.get(now.getFullYear(), now.getMonth() + 1);
  }, []);

  const dailyGoal = useMemo(() => {
    if (metric !== "revenue" || !goal) return undefined;
    const now = new Date();
    return goal.revenue / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }, [metric, goal]);

  const chartData   = useMemo(() => buildChartData(entries, from, to, metric), [entries, from, to, metric]);
  const metricDef   = METRICS.find(m => m.key === metric)!;
  const hasData     = chartData.some(p => p.current > 0);
  const interval    = chartData.length > 30 ? 6 : chartData.length > 14 ? 2 : 0;
  const goalRefLine = metric === "roas" ? 3 : undefined;

  const metricChange = useMemo(() => {
    const cur  = getTotalForMetric(totals, metric);
    const prev = getTotalForMetric(prevTotals, metric);
    if (prev === 0) return null;
    return ((cur - prev) / prev) * 100;
  }, [totals, prevTotals, metric]);

  const insights = useMemo((): InsightItem[] => {
    const list: InsightItem[] = [];

    if (prevTotals.revenue > 0) {
      const pct = ((totals.revenue - prevTotals.revenue) / prevTotals.revenue) * 100;
      list.push({
        label: "Receita", value: `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}% vs anterior`,
        direction: Math.abs(pct) < 1 ? "neutral" : pct > 0 ? "up" : "down",
        positive: true,
      });
    }
    if (prevTotals.conversionRate > 0 && totals.conversionRate > 0) {
      const diff = totals.conversionRate - prevTotals.conversionRate;
      list.push({
        label: "Conversão", value: `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}pp`,
        direction: Math.abs(diff) < 0.5 ? "neutral" : diff > 0 ? "up" : "down",
        positive: true,
      });
    }
    if (totals.roas > 0) {
      list.push({
        label: "ROAS",
        value: `${totals.roas.toFixed(2)}x${totals.roas >= 3 ? " · meta ✓" : " · abaixo de 3x"}`,
        direction: totals.roas >= 3 ? "up" : "down",
        positive: totals.roas >= 3,
      });
    }
    if (totals.revenue > 0) {
      const f    = new Date(from + "T12:00:00");
      const t    = new Date(to   + "T12:00:00");
      const days = Math.max(1, Math.round((t.getTime() - f.getTime()) / 86_400_000) + 1);
      list.push({
        label: "Projeção 30d", value: formatBRL((totals.revenue / days) * 30),
        direction: "neutral", positive: true,
      });
    }
    if (prevTotals.cpl > 0 && totals.cpl > 0) {
      const pct = ((totals.cpl - prevTotals.cpl) / prevTotals.cpl) * 100;
      list.push({
        label: "CPL", value: `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}% vs anterior`,
        direction: Math.abs(pct) < 1 ? "neutral" : pct > 0 ? "up" : "down",
        positive: false,
      });
    }
    return list;
  }, [totals, prevTotals, from, to]);

  const sellerRows = useMemo((): SellerRow[] => {
    // Derive seller stats directly from entries — avoids sellerStatsRepository sync bugs
    const statsMap = new Map<string, { sales: number; revenue: number }>();
    for (const e of entries) {
      if (!e.sellerId || e.date < from || e.date > to) continue;
      const p = statsMap.get(e.sellerId) ?? { sales: 0, revenue: 0 };
      statsMap.set(e.sellerId, { sales: p.sales + e.sales, revenue: p.revenue + e.revenue });
    }
    const totalRev = Array.from(statsMap.values()).reduce((a, s) => a + s.revenue, 0);
    return sellers
      .map(s => {
        const st = statsMap.get(s.id) ?? { sales: 0, revenue: 0 };
        return {
          id: s.id, name: s.name,
          revenue:   st.revenue,
          sales:     st.sales,
          avgTicket: st.sales > 0 ? st.revenue / st.sales : 0,
          share:     totalRev > 0 ? (st.revenue / totalRev) * 100 : 0,
        };
      })
      .filter(r => r.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [sellers, entries, from, to]);

  const safeFmt = (v: number | string | undefined) => {
    const n = typeof v === "number" ? v : Number(v ?? 0);
    return metricDef.fmt(n);
  };

  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">

      {/* Period filter */}
      <div className="flex items-center gap-2 mb-5">
        <div className="flex items-center gap-0.5 bg-gray-100/80 p-1 rounded-xl">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={cn(
                "h-7 px-3.5 rounded-lg text-xs font-semibold transition-all duration-150",
                period === key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-400 hover:text-gray-700",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick insights strip */}
      {insights.length > 0 && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-0.5">
          {insights.map((ins, i) => <InsightPill key={i} {...ins} />)}
        </div>
      )}

      {/* KPI groups */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KpiGroup title="Receita" accent="bg-green-500">
          <KpiItem label="Faturamento" value={formatBRL(totals.revenue)} />
          <KpiItem
            label="Lucro"
            value={formatBRL(totals.profit)}
            highlight={totals.profit > 0 ? "green" : totals.profit < 0 ? "red" : null}
          />
          <KpiItem
            label="Ticket Médio"
            value={totals.avgTicket > 0 ? formatBRL(totals.avgTicket) : "—"}
          />
        </KpiGroup>

        <KpiGroup title="Aquisição" accent="bg-blue-400">
          <KpiItem label="Investimento" value={formatBRL(totals.investment)} />
          <KpiItem label="Leads"        value={totals.leads > 0 ? totals.leads.toLocaleString("pt-BR") : "—"} />
          <KpiItem label="CPL"          value={totals.cpl > 0 ? formatBRL(totals.cpl) : "—"} />
        </KpiGroup>

        <KpiGroup title="Comercial" accent="bg-violet-400">
          <KpiItem label="Vendas" value={totals.sales > 0 ? totals.sales.toLocaleString("pt-BR") : "—"} />
          <KpiItem
            label="Conversão"
            value={formatPct(totals.conversionRate)}
            highlight={totals.conversionRate >= 20 ? "green" : null}
          />
          <KpiItem
            label="ROAS"
            value={formatROAS(totals.roas)}
            highlight={totals.roas >= 3 ? "green" : (totals.roas > 0 && totals.roas < 1.5) ? "red" : null}
          />
        </KpiGroup>
      </div>

      {/* Main chart */}
      <div
        className="bg-white rounded-2xl border border-gray-100/80 p-5 mb-5"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">{metricDef.label}</p>
            {metricChange !== null ? (
              <p className={cn(
                "text-xs mt-0.5 font-medium",
                Math.abs(metricChange) < 1  ? "text-gray-400" :
                  (metricChange > 0) === metricDef.goodUp ? "text-green-600" : "text-red-400",
              )}>
                {metricChange >= 0 ? "+" : ""}{metricChange.toFixed(1)}% vs período anterior
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">Evolução no período</p>
            )}
          </div>

          {/* Metric switcher */}
          <div className="flex items-center flex-wrap justify-end gap-1 bg-gray-100/60 p-1 rounded-xl">
            {METRICS.map(m => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={cn(
                  "h-7 px-3 rounded-lg text-xs font-semibold transition-all duration-150",
                  metric === m.key
                    ? "bg-gray-900 text-white shadow-sm"
                    : "text-gray-400 hover:text-gray-700",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 mb-4">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-[2px] rounded-full" style={{ background: CHART_COLOR }} />
            <span className="text-[10px] text-gray-400">Período atual</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-[1px]" style={{ background: "repeating-linear-gradient(90deg,#94a3b8 0,#94a3b8 3px,transparent 3px,transparent 6px)" }} />
            <span className="text-[10px] text-gray-400">Período anterior</span>
          </div>
          {(goalRefLine !== undefined || dailyGoal !== undefined) && (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-[1px]" style={{ background: "repeating-linear-gradient(90deg,#f59e0b 0,#f59e0b 3px,transparent 3px,transparent 6px)" }} />
              <span className="text-[10px] text-gray-400">Meta</span>
            </div>
          )}
        </div>

        {/* Chart */}
        {!hasData ? (
          <div className="h-[300px] flex flex-col items-center justify-center gap-2">
            <TrendingUp size={28} className="text-gray-200" strokeWidth={1.5} />
            <p className="text-sm text-gray-300">Sem dados no período</p>
          </div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 20, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradMain" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={CHART_COLOR} stopOpacity={0.14} />
                    <stop offset="100%" stopColor={CHART_COLOR} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#F1F5F9" strokeWidth={1} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#94A3B8" }}
                  tickLine={false} axisLine={false}
                  interval={interval}
                />
                <YAxis
                  tickFormatter={safeFmt}
                  tick={{ fontSize: 10, fill: "#94A3B8" }}
                  tickLine={false} axisLine={false}
                  width={56}
                />
                <Tooltip
                  content={(props) => (
                    <ChartTooltip
                      active={props.active}
                      payload={props.payload as unknown as Array<{ value?: number; dataKey?: string }>}
                      label={props.label as string}
                      metricLabel={metricDef.label}
                      valueFmt={metricDef.fmt}
                    />
                  )}
                  cursor={{ stroke: "#E2E8F0", strokeWidth: 1 }}
                />
                {goalRefLine !== undefined && (
                  <ReferenceLine y={goalRefLine} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 4" />
                )}
                {dailyGoal !== undefined && (
                  <ReferenceLine y={dailyGoal} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 4" />
                )}
                <Line
                  type="monotone" dataKey="previous"
                  stroke="#CBD5E1" strokeWidth={1.5} strokeDasharray="5 4"
                  dot={false} activeDot={false}
                />
                <Area
                  type="monotone" dataKey="current"
                  stroke={CHART_COLOR} strokeWidth={2.5}
                  fill="url(#gradMain)"
                  dot={false}
                  activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2, fill: CHART_COLOR }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Bottom: Heatmap + Seller ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        <HeatmapCalendar entries={entries} />
        <div
          className="bg-white rounded-2xl border border-gray-100/80 p-5"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)" }}
        >
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-900">Ranking de Vendedores</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Por faturamento no período</p>
          </div>
          <SellerRankingList rows={sellerRows} />
        </div>
      </div>
    </div>
  );
}
