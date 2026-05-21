"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Plus, Target } from "lucide-react";
import { KPICard } from "@/components/kpi-card";
import { RevenueChart } from "@/components/revenue-chart";
import { SellerRanking } from "@/components/seller-ranking";
import { DateFilter } from "@/components/date-filter";
import { useDashboardData, type Period } from "@/hooks/use-dashboard-data";

// ─── Formatters ────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function fmtDec(v: number, d = 2) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtBRLLong(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 py-16">
      <div className="w-20 h-20 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
        <TrendingUp size={32} className="text-gray-300" strokeWidth={1.5} />
      </div>
      <div className="text-center max-w-xs">
        <h2 className="text-xl font-bold text-gray-900">Nenhum dado registrado</h2>
        <p className="text-sm text-gray-400 mt-2 leading-relaxed">
          Preencha os resultados de hoje para começar a visualizar suas métricas em tempo real.
        </p>
      </div>
      <Link
        href="/input"
        className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 active:scale-[0.99] transition-all shadow-[0_4px_14px_rgba(90,137,119,0.3)]"
      >
        <Plus size={16} strokeWidth={2.5} />
        Preencher hoje
      </Link>
    </div>
  );
}

// ─── Goal progress section ─────────────────────────────────────────────────────

interface GoalProgressProps {
  monthRevenue: number;
  monthLeads:   number;
  monthSales:   number;
  goal:         { revenue: number; leads: number; sales: number } | null;
}

function GoalProgress({ monthRevenue, monthLeads, monthSales, goal }: GoalProgressProps) {
  const today       = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dayOfMonth  = today.getDate();
  const monthName   = today.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const items = [
    {
      label:   "Receita",
      current: monthRevenue,
      target:  goal?.revenue ?? 0,
      color:   "linear-gradient(90deg, #1a9e62, #57d49c)",
      fmt:     (v: number) => fmtBRLLong(v),
    },
    {
      label:   "Leads",
      current: monthLeads,
      target:  goal?.leads ?? 0,
      color:   "#8B5CF6",
      fmt:     (v: number) => v.toLocaleString("pt-BR"),
    },
    {
      label:   "Vendas",
      current: monthSales,
      target:  goal?.sales ?? 0,
      color:   "#3B82F6",
      fmt:     (v: number) => v.toLocaleString("pt-BR"),
    },
  ];

  const overallPct =
    goal && goal.revenue > 0
      ? ((monthRevenue / goal.revenue) * 100).toFixed(1)
      : null;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100/80 p-5"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)" }}
    >
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 capitalize">
            Meta vs Realizado
          </p>
          <p className="text-xs text-gray-400 mt-0.5 capitalize">
            {monthName} · {dayOfMonth} de {daysInMonth} dias
          </p>
        </div>

        {overallPct !== null ? (
          <span className="text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-100">
            {overallPct}% da meta
          </span>
        ) : (
          <Link
            href="/goals"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-150 px-3 py-1.5 rounded-xl transition-colors"
          >
            <Target size={12} strokeWidth={2.5} />
            Definir metas
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {items.map(({ label, current, target, color, fmt }) => {
          const pct = target > 0 ? Math.min((current / target) * 100, 100) : null;
          return (
            <div key={label}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600">{label}</span>
                <span className="text-xs font-bold text-gray-900">
                  {pct !== null ? `${pct.toFixed(1)}%` : "—"}
                </span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                {pct !== null && (
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: color }}
                  />
                )}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[11px] font-medium text-gray-500">
                  {fmt(current)}
                </span>
                {target > 0 ? (
                  <span className="text-[11px] text-gray-300">Meta {fmt(target)}</span>
                ) : (
                  <Link href="/goals" className="text-[11px] text-green-500 hover:underline">
                    + Definir →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Shell ─────────────────────────────────────────────────────────────────────

export function DashboardShell() {
  const [period, setPeriod] = useState<Period>("30d");
  const data = useDashboardData(period);

  if (!data.hasData) return <EmptyState />;

  const projectionPct =
    data.goal && data.goal.revenue > 0 && data.projection
      ? ((data.projection - data.goal.revenue) / data.goal.revenue) * 100
      : null;

  const kpis = [
    {
      label: "Receita",
      value: fmtBRL(data.revenue.value),
      prefix: "R$",
      trend: data.revenue.trend,
      description: "vs período ant.",
    },
    {
      label: "Investimento",
      value: fmtBRL(data.investment.value),
      prefix: "R$",
      trend: data.investment.trend,
      description: "vs período ant.",
    },
    {
      label: "Lucro",
      value: fmtBRL(data.profit.value),
      prefix: "R$",
      trend: data.profit.trend,
      description: "vs período ant.",
    },
    {
      label: "ROAS",
      value: fmtDec(data.roas.value),
      suffix: "x",
      trend: data.roas.trend,
      description: "retorno",
    },
    {
      label: "Leads",
      value: fmtBRL(data.leads.value),
      trend: data.leads.trend,
      description: "vs período ant.",
    },
    {
      label: "Vendas",
      value: fmtBRL(data.sales.value),
      trend: data.sales.trend,
      description: "vs período ant.",
    },
    {
      label: "Conversão",
      value: fmtDec(data.conversionRate.value),
      suffix: "%",
      trend: data.conversionRate.trend,
      description: "leads → venda",
    },
    {
      label: "Ticket Médio",
      value: fmtBRL(data.avgTicket.value),
      prefix: "R$",
      trend: data.avgTicket.trend,
      description: "por venda",
    },
  ];

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-0.5 capitalize">
            {new Date().toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
          {/* Projection badge */}
          {data.projection !== null && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-xs font-medium text-green-700">
                Projeção mensal:
              </span>
              <span className="text-xs font-bold text-green-800">
                {fmtBRLLong(data.projection)}
              </span>
              {projectionPct !== null && (
                <div
                  className={`flex items-center gap-0.5 text-[11px] font-semibold ${projectionPct >= 0 ? "text-green-600" : "text-red-500"}`}
                >
                  {projectionPct >= 0 ? (
                    <TrendingUp size={12} strokeWidth={2.5} />
                  ) : (
                    <TrendingDown size={12} strokeWidth={2.5} />
                  )}
                  {projectionPct >= 0 ? "+" : ""}
                  {projectionPct.toFixed(1)}% meta
                </div>
              )}
            </div>
          )}

          <DateFilter value={period} onChange={setPeriod} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Chart + Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7">
          <RevenueChart data={data.chartData} />
        </div>
        <div className="lg:col-span-5">
          <SellerRanking />
        </div>

      </div>

      {/* Goal progress */}
      <GoalProgress
        monthRevenue={data.monthRevenue}
        monthLeads={data.monthLeads}
        monthSales={data.monthSales}
        goal={data.goal}
      />
    </div>
  );
}
