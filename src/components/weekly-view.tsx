"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import { ArrowLeft, TrendingUp, TrendingDown, CalendarDays } from "lucide-react";
import { entryRepository } from "@/lib/storage";
import { useTheme } from "@/hooks/use-theme";
import { computeMetrics, type DailyEntry } from "@/types/daily-entry";
import { cn } from "@/lib/utils";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const SHORT_MONTHS = [
  "Jan","Fev","Mar","Abr","Mai","Jun",
  "Jul","Ago","Set","Out","Nov","Dez",
];

function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

function weekLabel(mondayStr: string, sundayStr: string): string {
  const [, mm, dd] = mondayStr.split("-").map(Number);
  const [, sm, sd] = sundayStr.split("-").map(Number);
  if (mm === sm) return `${dd}–${sd} ${SHORT_MONTHS[mm - 1]}`;
  return `${dd} ${SHORT_MONTHS[mm - 1]} – ${sd} ${SHORT_MONTHS[sm - 1]}`;
}

function weekLabelShort(mondayStr: string): string {
  const [, mm, dd] = mondayStr.split("-").map(Number);
  return `${dd} ${SHORT_MONTHS[mm - 1]}`;
}

function formatBRL(v: number): string {
  if (v === 0) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

function formatBRLShort(v: number): string {
  if (v === 0) return "—";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function formatK(v: number): string {
  if (v === 0) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

// ─── Data types ────────────────────────────────────────────────────────────────

interface WeekRow {
  key:            string;  // monday ISO — for sorting
  label:          string;  // "12–18 Mai"
  labelShort:     string;  // "12 Mai" — for chart X axis
  investment:     number;
  leads:          number;
  sales:          number;
  revenue:        number;
  profit:         number;
  roas:           number;
  conversionRate: number;
  daysWithData:   number;
  isCurrentWeek:  boolean;
}

// ─── Aggregation ───────────────────────────────────────────────────────────────

function computeWeeks(entries: DailyEntry[], numWeeks: number): WeekRow[] {
  const today        = new Date();
  const currentMon   = mondayOf(today);
  const weeks: WeekRow[] = [];

  for (let i = numWeeks - 1; i >= 0; i--) {
    const mon = new Date(currentMon);
    mon.setDate(currentMon.getDate() - i * 7);
    const mondayStr = toISO(mon);
    const sunDate   = new Date(mon);
    sunDate.setDate(mon.getDate() + 6);
    const sundayStr = toISO(sunDate);

    const weekEntries = entries.filter(
      (e) => e.date >= mondayStr && e.date <= sundayStr,
    );

    const totals = weekEntries.reduce(
      (acc, e) => ({
        investment: acc.investment + e.investment,
        leads:      acc.leads      + e.leads,
        sales:      acc.sales      + e.sales,
        revenue:    acc.revenue    + e.revenue,
      }),
      { investment: 0, leads: 0, sales: 0, revenue: 0 },
    );

    const m = computeMetrics(
      totals.investment, totals.leads, totals.sales, totals.revenue,
    );

    weeks.push({
      key:            mondayStr,
      label:          weekLabel(mondayStr, sundayStr),
      labelShort:     weekLabelShort(mondayStr),
      ...totals,
      profit:         m.profit,
      roas:           m.roas,
      conversionRate: m.conversionRate,
      daysWithData:   weekEntries.length,
      isCurrentWeek:  i === 0,
    });
  }

  return weeks;
}

// ─── Custom chart tooltip ──────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, chartColor }: TooltipContentProps & { chartColor: string }) {
  if (!active || !payload?.length) return null;
  const revenue    = (payload.find((p) => p.dataKey === "revenue")?.value    as number) ?? 0;
  const investment = (payload.find((p) => p.dataKey === "investment")?.value as number) ?? 0;
  const profit     = revenue - investment;
  return (
    <div
      className="bg-white rounded-xl border border-gray-100 p-3 min-w-[160px]"
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.10)" }}
    >
      <p className="text-xs font-semibold text-gray-500 mb-2">{label}</p>
      {[
        { label: "Receita",       value: revenue,    color: chartColor },
        { label: "Investimento",  value: investment, color: "#94A3B8" },
        { label: "Lucro",         value: profit,     color: profit >= 0 ? chartColor : "#EF4444" },
      ].map(({ label: l, value, color }) => (
        <div key={l} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-xs text-gray-500">{l}</span>
          </div>
          <span className="text-xs font-bold text-gray-900">{formatBRL(value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Summary KPI card ──────────────────────────────────────────────────────────

function SummaryCard({
  label, value, trend, sub,
}: {
  label: string;
  value: string;
  trend?: number;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100/80 px-4 py-4"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)" }}
    >
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{label}</p>
      <p className="text-xl font-bold text-gray-900 leading-none">{value}</p>
      {trend !== undefined && (
        <div className={cn(
          "inline-flex items-center gap-0.5 text-[11px] font-semibold mt-1.5",
          trend > 0 ? "text-green-600" : trend < 0 ? "text-red-500" : "text-gray-400",
        )}>
          {trend > 0 ? <TrendingUp size={11} strokeWidth={2.5} /> : trend < 0 ? <TrendingDown size={11} strokeWidth={2.5} /> : null}
          {trend > 0 ? "+" : ""}{trend.toFixed(1)}% vs sem. ant.
        </div>
      )}
      {sub && !trend && (
        <p className="text-xs text-gray-400 mt-1">{sub}</p>
      )}
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-5">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
        <CalendarDays size={28} className="text-gray-300" strokeWidth={1.5} />
      </div>
      <div className="text-center max-w-xs">
        <p className="text-base font-bold text-gray-800">Nenhum dado registrado</p>
        <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">
          Preencha os resultados diários para visualizar a visão semanal.
        </p>
      </div>
      <Link
        href="/input"
        className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors shadow-[0_4px_14px_rgba(90,137,119,0.25)]"
      >
        Preencher agora →
      </Link>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: "4 semanas",  value: 4  },
  { label: "8 semanas",  value: 8  },
  { label: "12 semanas", value: 12 },
];

const LIGHT_COLOR = "#5a8977";
const DARK_COLOR  = "#7bceae";

export function WeeklyView() {
  const { isDark }              = useTheme();
  const chartColor              = isDark ? DARK_COLOR : LIGHT_COLOR;
  const [entries, setEntries]   = useState<DailyEntry[]>([]);
  const [numWeeks, setNumWeeks] = useState<4 | 8 | 12>(8);

  useEffect(() => {
    const load = () => setEntries(entryRepository.list());
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  const weeks = useMemo(
    () => computeWeeks(entries, numWeeks),
    [entries, numWeeks],
  );

  const hasData = weeks.some((w) => w.daysWithData > 0);

  // Summary: totals across visible weeks with data
  const summary = useMemo(() => {
    const totals = weeks.reduce(
      (acc, w) => ({
        revenue:    acc.revenue    + w.revenue,
        investment: acc.investment + w.investment,
        sales:      acc.sales      + w.sales,
        leads:      acc.leads      + w.leads,
      }),
      { revenue: 0, investment: 0, sales: 0, leads: 0 },
    );
    const profit = totals.revenue - totals.investment;
    const roas   = totals.investment > 0 ? totals.revenue / totals.investment : 0;

    // Week-over-week trend for the most recent complete week vs the one before
    const last2 = weeks.filter((w) => w.daysWithData > 0).slice(-2);
    const revTrend =
      last2.length === 2 && last2[0].revenue > 0
        ? ((last2[1].revenue - last2[0].revenue) / last2[0].revenue) * 100
        : undefined;

    return { ...totals, profit, roas, revTrend };
  }, [weeks]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors mb-3"
          >
            <ArrowLeft size={13} strokeWidth={2.5} />
            Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Visão Semanal</h1>
          <p className="text-sm text-gray-400 mt-0.5">Desempenho semana a semana</p>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-1 mt-8 bg-gray-100 rounded-xl p-1 flex-shrink-0">
          {PERIOD_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setNumWeeks(value as 4 | 8 | 12)}
              className={cn(
                "h-8 px-3 rounded-lg text-xs font-semibold transition-all",
                numWeeks === value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <EmptyState />
      ) : (
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard
              label="Receita"
              value={formatBRLShort(summary.revenue)}
              trend={summary.revTrend}
            />
            <SummaryCard
              label="Lucro"
              value={formatBRLShort(summary.profit)}
              sub={`Invest. ${formatBRLShort(summary.investment)}`}
            />
            <SummaryCard
              label="ROAS médio"
              value={summary.roas > 0 ? `${summary.roas.toFixed(2)}x` : "—"}
              sub="retorno sobre investimento"
            />
            <SummaryCard
              label="Vendas"
              value={summary.sales > 0 ? summary.sales.toLocaleString("pt-BR") : "—"}
              sub={`${summary.leads.toLocaleString("pt-BR")} leads`}
            />
          </div>

          {/* Bar chart */}
          <div
            className="bg-white rounded-2xl border border-gray-100/80 p-5"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)" }}
          >
            <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Receita vs Investimento</p>
                <p className="text-xs text-gray-400 mt-0.5">Semana a semana</p>
              </div>
              <div className="flex items-center gap-4">
                {[
                  { color: chartColor, label: "Receita" },
                  { color: "#CBD5E1", label: "Investimento" },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
                    <span className="text-xs text-gray-400">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weeks}
                  margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                  barCategoryGap="28%"
                  barGap={3}
                >
                  <CartesianGrid vertical={false} stroke="#F1F5F9" strokeWidth={1} strokeOpacity={isDark ? 0.1 : 0.9} />
                  <XAxis
                    dataKey="labelShort"
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    tickLine={false}
                    axisLine={false}
                    interval={numWeeks > 8 ? 1 : 0}
                  />
                  <YAxis
                    tickFormatter={formatK}
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip content={(props) => <ChartTooltip {...props} chartColor={chartColor} />} cursor={{ fill: "#F8FAFC" }} />
                  <Bar dataKey="revenue"    fill={chartColor} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="investment" fill="#E2E8F0" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Week-by-week table */}
          <div
            className="bg-white rounded-2xl border border-gray-100/80 overflow-hidden"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)" }}
          >
            <div className="px-5 py-4 border-b border-gray-50">
              <p className="text-sm font-semibold text-gray-900">Detalhamento por Semana</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-gray-50">
                    {[
                      { label: "Semana",       align: "left"  },
                      { label: "Dias",         align: "right" },
                      { label: "Receita",      align: "right" },
                      { label: "Investimento", align: "right" },
                      { label: "Lucro",        align: "right" },
                      { label: "ROAS",         align: "right" },
                      { label: "Leads",        align: "right" },
                      { label: "Vendas",       align: "right" },
                    ].map(({ label, align }) => (
                      <th
                        key={label}
                        className={cn(
                          "px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest",
                          align === "right" ? "text-right" : "text-left",
                        )}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...weeks].reverse().map((w) => {
                    const isEmpty = w.daysWithData === 0;
                    return (
                      <tr
                        key={w.key}
                        className={cn(
                          "transition-colors",
                          w.isCurrentWeek ? "bg-green-50/40" : "hover:bg-gray-50/40",
                          isEmpty && "opacity-40",
                        )}
                      >
                        <td className="px-4 py-3 text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800">{w.label}</span>
                            {w.isCurrentWeek && (
                              <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                                atual
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-gray-400">
                          {isEmpty ? "—" : `${w.daysWithData}d`}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                          {formatBRL(w.revenue)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                          {formatBRL(w.investment)}
                        </td>
                        <td className={cn(
                          "px-4 py-3 text-right text-sm font-semibold",
                          w.profit > 0 ? "text-green-600" : w.profit < 0 ? "text-red-500" : "text-gray-400",
                        )}>
                          {isEmpty ? "—" : formatBRL(w.profit)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700">
                          {w.roas > 0 ? `${w.roas.toFixed(2)}x` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                          {w.leads > 0 ? w.leads.toLocaleString("pt-BR") : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700 font-medium">
                          {w.sales > 0 ? w.sales.toLocaleString("pt-BR") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
