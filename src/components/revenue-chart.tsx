"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { type TooltipContentProps } from "recharts";
import { TrendingUp } from "lucide-react";
import type { ChartPoint } from "@/hooks/use-dashboard-data";
import { useTheme } from "@/hooks/use-theme";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatK(value: number): string {
  if (value === 0) return "0";
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return String(value);
}

// ─── Custom tooltip ────────────────────────────────────────────────────────────

const LIGHT_COLOR = "#5a8977";
const DARK_COLOR  = "#7bceae";

function CustomTooltip({ active, payload, label, chartColor }: TooltipContentProps & { chartColor: string }) {
  if (!active || !payload?.length) return null;
  const entries = [
    { key: "revenue",    label: "Receita",       color: chartColor },
    { key: "target",     label: "Meta diária",   color: "#94A3B8"  },
    { key: "prevPeriod", label: "Per. anterior", color: "#CBD5E1"  },
  ];
  return (
    <div
      className="bg-white rounded-xl border border-gray-100 p-3 min-w-[160px]"
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.10)" }}
    >
      <p className="text-xs font-semibold text-gray-500 mb-2">{label}</p>
      {entries.map(({ key, label: l, color }) => {
        const entry = payload.find((p) => p.dataKey === key);
        if (!entry || (entry.value as number) === 0) return null;
        return (
          <div key={key} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="text-xs text-gray-500">{l}</span>
            </div>
            <span className="text-xs font-bold text-gray-900">
              {formatBRL(entry.value as number)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Legend ────────────────────────────────────────────────────────────────────

function ChartLegend({ hasTarget, chartColor }: { hasTarget: boolean; chartColor: string }) {
  const items = [
    { color: chartColor, label: "Receita",      dash: false },
    ...(hasTarget ? [{ color: "#94A3B8", label: "Meta diária", dash: true  }] : []),
    { color: "#CBD5E1", label: "Per. anterior", dash: false },
  ];
  return (
    <div className="flex items-center gap-5">
      {items.map(({ color, label, dash }) => (
        <div key={label} className="flex items-center gap-1.5">
          {dash ? (
            <svg width="20" height="2" viewBox="0 0 20 2">
              <line x1="0" y1="1" x2="8" y2="1" stroke={color} strokeWidth="1.5" />
              <line x1="12" y1="1" x2="20" y2="1" stroke={color} strokeWidth="1.5" />
            </svg>
          ) : (
            <div className="w-5 h-0.5 rounded-full" style={{ background: color }} />
          )}
          <span className="text-xs text-gray-400">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function ChartEmpty() {
  return (
    <div className="h-[280px] flex flex-col items-center justify-center gap-2">
      <TrendingUp size={28} className="text-gray-200" strokeWidth={1.5} />
      <p className="text-sm text-gray-400">Preencha dados para ver o gráfico</p>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface RevenueChartProps {
  data: ChartPoint[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  const { isDark }  = useTheme();
  const chartColor  = isDark ? DARK_COLOR : LIGHT_COLOR;
  const hasRevenue  = data.some((d) => d.revenue > 0);
  const hasTarget   = data.some((d) => d.target > 0);
  const hasPrev     = data.some((d) => d.prevPeriod > 0);

  // XAxis: avoid overcrowding on wide periods
  const xInterval = data.length > 30 ? 6 : data.length > 14 ? 2 : 0;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100/80 p-5 flex flex-col gap-4"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Evolução de Receita</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {hasTarget ? "Receita diária vs meta e período anterior" : "Receita diária vs período anterior"}
          </p>
        </div>
        <ChartLegend hasTarget={hasTarget} chartColor={chartColor} />
      </div>

      {!hasRevenue ? (
        <ChartEmpty />
      ) : (
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={chartColor} stopOpacity={isDark ? 0.35 : 0.2} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradTarget" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#94A3B8" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#94A3B8" stopOpacity={0}    />
                </linearGradient>
                <linearGradient id="gradPrev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#CBD5E1" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#CBD5E1" stopOpacity={0}    />
                </linearGradient>
              </defs>

              <CartesianGrid vertical={false} stroke="#F1F5F9" strokeWidth={1} strokeOpacity={isDark ? 0.1 : 0.9} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#94A3B8" }}
                tickLine={false}
                axisLine={false}
                interval={xInterval}
              />
              <YAxis
                tickFormatter={formatK}
                tick={{ fontSize: 11, fill: "#94A3B8" }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                content={(props) => <CustomTooltip {...props} chartColor={chartColor} />}
                cursor={{ stroke: "#E2E8F0", strokeWidth: 1 }}
              />

              {hasPrev && (
                <Area
                  type="monotone"
                  dataKey="prevPeriod"
                  stroke="#CBD5E1"
                  strokeWidth={1.5}
                  fill="url(#gradPrev)"
                  dot={false}
                  activeDot={false}
                />
              )}
              {hasTarget && (
                <Area
                  type="monotone"
                  dataKey="target"
                  stroke="#94A3B8"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  fill="url(#gradTarget)"
                  dot={false}
                  activeDot={false}
                />
              )}
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={chartColor}
                strokeWidth={2.5}
                fill="url(#gradRevenue)"
                dot={false}
                activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2, fill: chartColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
