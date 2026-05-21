"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { type TooltipContentProps } from "recharts";
import { TrendingUp } from "lucide-react";
import { KPICard } from "@/components/kpi-card";
import { useTheme } from "@/hooks/use-theme";
import type { TrafficKPIs, TrafficPoint } from "@/types/traffic";

// ─── Number formatters ────────────────────────────────────────────────────────

function fmtBRL(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000)    return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function fmtDec(value: number, d = 2): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

function fmtInt(value: number): string {
  return value.toLocaleString("pt-BR");
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionLabel({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span
        className="text-[10px] font-bold tracking-[0.18em] uppercase"
        style={{ color }}
      >
        {label}
      </span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

// ─── Custom chart tooltip ─────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: TooltipContentProps) {
  if (!active || !payload?.length) return null;

  const rows = [
    { key: "leads",     label: "Leads",        color: "#5a8977", fmt: (v: number) => fmtInt(v) },
    { key: "prevLeads", label: "Per. anterior", color: "#CBD5E1", fmt: (v: number) => fmtInt(v) },
    { key: "goalLeads", label: "Meta",          color: "#5a8977", fmt: (v: number) => fmtInt(v), dash: true },
    { key: "sales",     label: "Vendas",        color: "#8B5CF6", fmt: (v: number) => fmtInt(v) },
    { key: "cpl",       label: "CPL",           color: "#3B82F6", fmt: (v: number) => `R$ ${fmtDec(v)}` },
    { key: "investment",label: "Investimento",  color: "#94A3B8", fmt: (v: number) => `R$ ${fmtBRL(v)}` },
  ];

  return (
    <div
      className="bg-white rounded-xl border border-gray-100 p-3 min-w-[180px]"
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.10)" }}
    >
      <p className="text-xs font-semibold text-gray-500 mb-2">{label}</p>
      {rows.map(({ key, label: l, color, fmt, dash }) => {
        const entry = payload.find(p => p.dataKey === key);
        if (!entry || entry.value === undefined) return null;
        const v = entry.value as number;
        if (v === 0) return null;
        return (
          <div key={key} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
            <div className="flex items-center gap-1.5">
              {dash ? (
                <svg width="16" height="2" viewBox="0 0 16 2">
                  <line x1="0" y1="1" x2="5"  y2="1" stroke={color} strokeWidth="1.5" />
                  <line x1="9" y1="1" x2="16" y2="1" stroke={color} strokeWidth="1.5" />
                </svg>
              ) : (
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
              )}
              <span className="text-xs text-gray-500">{l}</span>
            </div>
            <span className="text-xs font-bold text-gray-900">{fmt(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Chart legend ─────────────────────────────────────────────────────────────

function ChartLegend({ chartColor }: { chartColor: string }) {
  const items = [
    { color: chartColor,  label: "Leads",          dash: false },
    { color: "#CBD5E1",   label: "Per. anterior",  dash: false },
    { color: chartColor,  label: "Meta",            dash: true  },
    { color: "#8B5CF6",   label: "Vendas",          dash: false },
    { color: "#3B82F6",   label: "CPL",             dash: false },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4">
      {items.map(({ color, label, dash }) => (
        <div key={label} className="flex items-center gap-1.5">
          {dash ? (
            <svg width="16" height="2" viewBox="0 0 16 2">
              <line x1="0" y1="1" x2="5"  y2="1" stroke={color} strokeWidth="1.5" />
              <line x1="9" y1="1" x2="16" y2="1" stroke={color} strokeWidth="1.5" />
            </svg>
          ) : (
            <div className="w-4 h-0.5 rounded-full" style={{ background: color }} />
          )}
          <span className="text-xs text-gray-400">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main chart ───────────────────────────────────────────────────────────────

function TrafficChart({ data }: { data: TrafficPoint[] }) {
  const { isDark } = useTheme();
  const chartColor = isDark ? "#7bceae" : "#5a8977";
  const hasData    = data.some(d => d.leads > 0);

  const xInterval = data.length > 30 ? 6 : data.length > 14 ? 2 : 0;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100/80 p-5 flex flex-col gap-4"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)" }}
    >
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Performance de Aquisição</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Leads diários vs meta, período anterior, vendas e CPL
          </p>
        </div>
        <ChartLegend chartColor={chartColor} />
      </div>

      {!hasData ? (
        <div className="h-[320px] flex flex-col items-center justify-center gap-2">
          <TrendingUp size={28} className="text-gray-200" strokeWidth={1.5} />
          <p className="text-sm text-gray-400">Sem dados para o período</p>
        </div>
      ) : (
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={chartColor} stopOpacity={isDark ? 0.35 : 0.18} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPrev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#CBD5E1" stopOpacity={0.10} />
                  <stop offset="100%" stopColor="#CBD5E1" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                vertical={false}
                stroke="#F1F5F9"
                strokeWidth={1}
                strokeOpacity={isDark ? 0.08 : 0.9}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#94A3B8" }}
                tickLine={false}
                axisLine={false}
                interval={xInterval}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "#94A3B8" }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(v) => `${v}`}
                tick={{ fontSize: 11, fill: "#3B82F6", opacity: 0.7 }}
                tickLine={false}
                axisLine={false}
                width={36}
              />

              <Tooltip
                content={(props) => <ChartTooltip {...props} />}
                cursor={{ stroke: "#E2E8F0", strokeWidth: 1 }}
              />

              {/* Previous period — behind everything */}
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="prevLeads"
                stroke="#CBD5E1"
                strokeWidth={1.5}
                fill="url(#gradPrev)"
                dot={false}
                activeDot={false}
              />

              {/* Goal — dotted line, no fill */}
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="goalLeads"
                stroke={chartColor}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                fill="none"
                dot={false}
                activeDot={false}
              />

              {/* Leads — primary area */}
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="leads"
                stroke={chartColor}
                strokeWidth={2.5}
                fill="url(#gradLeads)"
                dot={false}
                activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2, fill: chartColor }}
              />

              {/* Sales — thin purple line */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="sales"
                stroke="#8B5CF6"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, stroke: "#fff", strokeWidth: 2, fill: "#8B5CF6" }}
              />

              {/* CPL — thin blue on right axis */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cpl"
                stroke="#3B82F6"
                strokeWidth={1.5}
                strokeOpacity={0.7}
                dot={false}
                activeDot={{ r: 3, stroke: "#fff", strokeWidth: 2, fill: "#3B82F6" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

interface TrafficOverviewProps {
  kpis: TrafficKPIs;
  chartData: TrafficPoint[];
}

export function TrafficOverview({ kpis, chartData }: TrafficOverviewProps) {
  const { trends: t } = kpis;

  return (
    <div className="px-8 py-6 space-y-8 max-w-[1280px]">
      {/* ── Aquisição ─────────────────────────────────────────────────────── */}
      <div>
        <SectionLabel label="Aquisição" color="#3B82F6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPICard
            label="Investimento"
            value={fmtBRL(kpis.investment)}
            prefix="R$"
            trend={t.investment}
            description="vs período ant."
          />
          <KPICard
            label="Leads"
            value={fmtInt(kpis.leads)}
            trend={t.leads}
            description="captados"
          />
          <KPICard
            label="CPL"
            value={fmtDec(kpis.cpl)}
            prefix="R$"
            trend={t.cpl}
            invertSentiment
            description="custo por lead"
          />
          <KPICard
            label="CPM"
            value={fmtDec(kpis.cpm)}
            prefix="R$"
            trend={t.cpm}
            invertSentiment
            description="por mil impressões"
          />
          <KPICard
            label="CTR"
            value={fmtDec(kpis.ctr)}
            suffix="%"
            trend={t.ctr}
            description="taxa de cliques"
          />
        </div>
      </div>

      {/* ── Qualidade ─────────────────────────────────────────────────────── */}
      <div>
        <SectionLabel label="Qualidade" color="#8B5CF6" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPICard
            label="MQLs"
            value={fmtInt(kpis.mqls)}
            trend={t.mqls}
            description="leads qualificados"
          />
          <KPICard
            label="Taxa de Qualificação"
            value={fmtDec(kpis.qualificationRate, 1)}
            suffix="%"
            trend={t.qualificationRate}
            description="leads → MQL"
          />
          <KPICard
            label="Conversão em Vendas"
            value={fmtDec(kpis.conversionToSales, 1)}
            suffix="%"
            trend={t.conversionToSales}
            description="leads → vendas"
          />
        </div>
      </div>

      {/* ── Receita ───────────────────────────────────────────────────────── */}
      <div>
        <SectionLabel label="Receita" color="#5a8977" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KPICard
            label="Faturamento"
            value={fmtBRL(kpis.revenue)}
            prefix="R$"
            trend={t.revenue}
            description="gerado por leads"
          />
          <KPICard
            label="CAC"
            value={fmtDec(kpis.cac)}
            prefix="R$"
            trend={t.cac}
            invertSentiment
            description="custo de aquisição"
          />
          <KPICard
            label="ROAS"
            value={fmtDec(kpis.roas)}
            suffix="x"
            trend={t.roas}
            description="retorno s/ gasto"
          />
          <KPICard
            label="ROI"
            value={fmtDec(kpis.roi, 1)}
            suffix="%"
            trend={t.roi}
            description="retorno s/ invest."
          />
        </div>
      </div>

      {/* ── Chart ─────────────────────────────────────────────────────────── */}
      <TrafficChart data={chartData} />
    </div>
  );
}
