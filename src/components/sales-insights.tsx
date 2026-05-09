"use client";

import { useState, useEffect, useMemo } from "react";
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Star, Zap, Target, BarChart3, Clock, Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { computeMetrics, type DailyEntry } from "@/types/daily-entry";
import { entryRepository, sellerRepository, sellerStatsRepository } from "@/lib/storage";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISO(d: Date) { return d.toISOString().split("T")[0]; }

function shiftDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function formatBRL(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000)      return `R$ ${(v / 1000).toFixed(1)}k`;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function pct(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

function filterRange(entries: DailyEntry[], from: string, to: string) {
  return entries.filter(e => e.date >= from && e.date <= to);
}

function sumEntries(entries: DailyEntry[]) {
  return entries.reduce(
    (acc, e) => ({
      investment: acc.investment + e.investment,
      leads:      acc.leads      + e.leads,
      sales:      acc.sales      + e.sales,
      revenue:    acc.revenue    + e.revenue,
    }),
    { investment: 0, leads: 0, sales: 0, revenue: 0 },
  );
}

const PT_WEEKDAYS = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];

// ─── Types ────────────────────────────────────────────────────────────────────

type Sentiment = "positive" | "negative" | "warning" | "neutral" | "info";

interface Insight {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  sentiment: Sentiment;
  value?: string;
}

// ─── Insight card ─────────────────────────────────────────────────────────────

const SENTIMENT_STYLES: Record<Sentiment, { bg: string; border: string; icon: string; badge: string }> = {
  positive: { bg: "bg-green-50",  border: "border-green-100",  icon: "text-green-600",  badge: "bg-green-100 text-green-700" },
  negative: { bg: "bg-red-50",    border: "border-red-100",    icon: "text-red-500",    badge: "bg-red-100 text-red-600"     },
  warning:  { bg: "bg-amber-50",  border: "border-amber-100",  icon: "text-amber-500",  badge: "bg-amber-100 text-amber-700" },
  neutral:  { bg: "bg-gray-50",   border: "border-gray-100",   icon: "text-gray-500",   badge: "bg-gray-100 text-gray-600"   },
  info:     { bg: "bg-blue-50",   border: "border-blue-100",   icon: "text-blue-500",   badge: "bg-blue-100 text-blue-700"   },
};

function InsightCard({ insight }: { insight: Insight }) {
  const s = SENTIMENT_STYLES[insight.sentiment];
  return (
    <div className={cn(
      "rounded-2xl border p-5 flex flex-col gap-3 transition-all hover:shadow-sm",
      s.bg, s.border,
    )}>
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 flex-shrink-0", s.icon)}>
          {insight.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 leading-snug">{insight.title}</p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{insight.description}</p>
        </div>
        {insight.value && (
          <span className={cn("flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full", s.badge)}>
            {insight.value}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Insight generator ────────────────────────────────────────────────────────

function generateInsights(entries: DailyEntry[], sellerMap: Map<string, string>): Insight[] {
  const today  = new Date();
  const now7   = { from: toISO(shiftDays(today, -6)),  to: toISO(today) };
  const prev7  = { from: toISO(shiftDays(today, -13)), to: toISO(shiftDays(today, -7)) };
  const now30  = { from: toISO(shiftDays(today, -29)), to: toISO(today) };
  const prev30 = { from: toISO(shiftDays(today, -59)), to: toISO(shiftDays(today, -30)) };

  const cur7  = sumEntries(filterRange(entries, now7.from, now7.to));
  const pre7  = sumEntries(filterRange(entries, prev7.from, prev7.to));
  const cur30 = sumEntries(filterRange(entries, now30.from, now30.to));

  const m7   = computeMetrics(cur7.investment, cur7.leads, cur7.sales, cur7.revenue);
  const pm7  = computeMetrics(pre7.investment, pre7.leads, pre7.sales, pre7.revenue);
  const m30  = computeMetrics(cur30.investment, cur30.leads, cur30.sales, cur30.revenue);

  const insights: Insight[] = [];

  if (entries.length === 0) {
    insights.push({
      id: "no-data",
      icon: <BarChart3 size={18} strokeWidth={2} />,
      title: "Nenhum dado registrado ainda",
      description: "Vá para Calendário e adicione seus primeiros registros de vendas para ver insights automáticos.",
      sentiment: "neutral",
    });
    return insights;
  }

  // 1. Revenue trend (7d vs prev 7d)
  if (cur7.revenue > 0 || pre7.revenue > 0) {
    const revPct = pct(cur7.revenue, pre7.revenue);
    const isUp   = revPct > 0;
    insights.push({
      id:          "revenue-trend",
      icon:        isUp ? <TrendingUp size={18} strokeWidth={2} /> : <TrendingDown size={18} strokeWidth={2} />,
      title:       isUp ? `Faturamento subiu ${revPct.toFixed(0)}%` : `Faturamento caiu ${Math.abs(revPct).toFixed(0)}%`,
      description: `Nos últimos 7 dias: ${formatBRL(cur7.revenue)}. Semana anterior: ${formatBRL(pre7.revenue)}.`,
      sentiment:   isUp ? "positive" : "negative",
      value:       `${isUp ? "+" : ""}${revPct.toFixed(1)}%`,
    });
  }

  // 2. ROAS status
  if (m30.roas > 0) {
    const roasGood = m30.roas >= 3;
    const roasOk   = m30.roas >= 1.5;
    insights.push({
      id:          "roas-status",
      icon:        roasGood ? <CheckCircle size={18} strokeWidth={2} /> : roasOk ? <AlertTriangle size={18} strokeWidth={2} /> : <AlertTriangle size={18} strokeWidth={2} />,
      title:       roasGood ? "ROAS acima da meta" : roasOk ? "ROAS abaixo da meta" : "ROAS crítico — abaixo de 1.5x",
      description: `Nos últimos 30 dias, cada R$ 1 investido gerou R$ ${m30.roas.toFixed(2)} em faturamento. Meta recomendada: ≥ 3x.`,
      sentiment:   roasGood ? "positive" : roasOk ? "warning" : "negative",
      value:       `${m30.roas.toFixed(2)}x`,
    });
  }

  // 3. Conversion rate trend
  if (m7.conversionRate > 0 || pm7.conversionRate > 0) {
    const convPct = pct(m7.conversionRate, pm7.conversionRate);
    const isUp    = convPct >= 0;
    if (Math.abs(convPct) > 5) {
      insights.push({
        id:          "conversion-trend",
        icon:        isUp ? <TrendingUp size={18} strokeWidth={2} /> : <TrendingDown size={18} strokeWidth={2} />,
        title:       isUp ? `Conversão melhorou ${convPct.toFixed(0)}%` : `Conversão caiu ${Math.abs(convPct).toFixed(0)}%`,
        description: `Taxa atual: ${m7.conversionRate.toFixed(1)}%. Semana anterior: ${pm7.conversionRate.toFixed(1)}%.`,
        sentiment:   isUp ? "positive" : "negative",
        value:       `${m7.conversionRate.toFixed(1)}%`,
      });
    }
  }

  // 4. CPL trend
  if (m7.cpl > 0 && pm7.cpl > 0) {
    const cplPct = pct(m7.cpl, pm7.cpl);
    if (Math.abs(cplPct) > 10) {
      const isUp = cplPct > 0; // higher CPL is worse
      insights.push({
        id:          "cpl-trend",
        icon:        isUp ? <TrendingDown size={18} strokeWidth={2} /> : <TrendingUp size={18} strokeWidth={2} />,
        title:       isUp ? `CPL subiu ${cplPct.toFixed(0)}%` : `CPL reduziu ${Math.abs(cplPct).toFixed(0)}%`,
        description: `Custo por lead esta semana: ${formatBRL(m7.cpl)}. Semana anterior: ${formatBRL(pm7.cpl)}.`,
        sentiment:   isUp ? "warning" : "positive",
        value:       formatBRL(m7.cpl),
      });
    }
  }

  // 5. Best day of week (last 30d)
  const dayRevenue = new Map<number, number>();
  for (const e of filterRange(entries, now30.from, now30.to)) {
    const [y, m, d] = e.date.split("-").map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    dayRevenue.set(dow, (dayRevenue.get(dow) ?? 0) + e.revenue);
  }
  if (dayRevenue.size > 0) {
    const bestDow = [...dayRevenue.entries()].sort((a, b) => b[1] - a[1])[0];
    insights.push({
      id:          "best-weekday",
      icon:        <Star size={18} strokeWidth={2} />,
      title:       `${PT_WEEKDAYS[bestDow[0]]} é o melhor dia`,
      description: `Nos últimos 30 dias, ${PT_WEEKDAYS[bestDow[0]].toLowerCase()} acumulou ${formatBRL(bestDow[1])} em faturamento — o maior entre todos os dias da semana.`,
      sentiment:   "info",
      value:       formatBRL(bestDow[1]),
    });
  }

  // 6. Today's pace vs average
  const todayISO = toISO(today);
  const todayEntries = filterRange(entries, todayISO, todayISO);
  if (todayEntries.length > 0) {
    const todayRev = sumEntries(todayEntries).revenue;
    const days30   = filterRange(entries, now30.from, now30.to);
    const daysWithData = new Set(days30.map(e => e.date)).size;
    const dailyAvg     = daysWithData > 0 ? cur30.revenue / daysWithData : 0;
    if (dailyAvg > 0) {
      const aboveAvg = todayRev >= dailyAvg;
      insights.push({
        id:          "today-pace",
        icon:        aboveAvg ? <Zap size={18} strokeWidth={2} /> : <Clock size={18} strokeWidth={2} />,
        title:       aboveAvg ? "Hoje está acima da média!" : "Hoje abaixo da média diária",
        description: `Faturamento de hoje: ${formatBRL(todayRev)}. Média diária dos últimos 30 dias: ${formatBRL(dailyAvg)}.`,
        sentiment:   aboveAvg ? "positive" : "warning",
        value:       formatBRL(todayRev),
      });
    }
  }

  // 7. Best seller (30d)
  const sellerRevMap = new Map<string, number>();
  for (const e of filterRange(entries, now30.from, now30.to)) {
    if (!e.sellerId) continue;
    sellerRevMap.set(e.sellerId, (sellerRevMap.get(e.sellerId) ?? 0) + e.revenue);
  }
  if (sellerRevMap.size > 0) {
    const [bestId, bestRev] = [...sellerRevMap.entries()].sort((a, b) => b[1] - a[1])[0];
    const bestName = sellerMap.get(bestId);
    if (bestName) {
      insights.push({
        id:          "best-seller",
        icon:        <Award size={18} strokeWidth={2} />,
        title:       `${bestName} lidera o ranking`,
        description: `Melhor vendedor nos últimos 30 dias com ${formatBRL(bestRev)} em faturamento.`,
        sentiment:   "positive",
        value:       formatBRL(bestRev),
      });
    }
  }

  // 8. Month projection vs pace
  const y = today.getFullYear(), mo = today.getMonth() + 1;
  const monthStart    = `${y}-${String(mo).padStart(2, "0")}-01`;
  const daysInMonth   = new Date(y, mo, 0).getDate();
  const monthEntries  = filterRange(entries, monthStart, todayISO);
  if (monthEntries.length > 0) {
    const monthTotal   = sumEntries(monthEntries).revenue;
    const dayOfMonth   = today.getDate();
    const projection   = (monthTotal / dayOfMonth) * daysInMonth;
    const pacePerDay   = monthTotal / dayOfMonth;
    insights.push({
      id:          "month-projection",
      icon:        <Target size={18} strokeWidth={2} />,
      title:       "Projeção para o mês",
      description: `Com base no ritmo atual (${formatBRL(pacePerDay)}/dia), a projeção de faturamento para ${PT_WEEKDAYS[0].substring(0,1)}${String(mo).padStart(2,"0")}/${y} é de ${formatBRL(projection)}.`,
      sentiment:   "info",
      value:       formatBRL(projection),
    });
  }

  return insights;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SalesInsights() {
  const [entries,  setEntries]  = useState<DailyEntry[]>([]);
  const [sellers,  setSellers]  = useState<Map<string, string>>(new Map());

  useEffect(() => {
    function load() {
      setEntries(entryRepository.list());
      const active = sellerRepository.listActive();
      setSellers(new Map(active.map(s => [s.id, s.name])));
    }
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  // suppress unused import
  void sellerStatsRepository;

  const insights = useMemo(() => generateInsights(entries, sellers), [entries, sellers]);

  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Gerado automaticamente</p>
          <p className="text-sm text-gray-500">
            {insights.length} insight{insights.length !== 1 ? "s" : ""} com base nos seus dados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-gray-400">Atualizado em tempo real</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {insights.map(insight => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  );
}
