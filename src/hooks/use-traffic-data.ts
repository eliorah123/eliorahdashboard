"use client";

import { useMemo } from "react";
import type {
  TrafficPeriod,
  TrafficPoint,
  TrafficKPIs,
  LeadRecord,
  LeadSource,
  LeadQuality,
  TrafficInsight,
} from "@/types/traffic";

// ─── Seeded pseudo-random ─────────────────────────────────────────────────────

function rng(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

// ─── Base mock dataset (90 days) ──────────────────────────────────────────────

interface RawDay {
  dateISO: string;
  dateLabel: string;
  leads: number;
  investment: number;
  sales: number;
  mqls: number;
  revenue: number;
  cpl: number;
  impressions: number;
  clicks: number;
}

const BASE_DATE = new Date(2026, 4, 13); // 2026-05-13

function buildRawDays(): RawDay[] {
  const days: RawDay[] = [];
  for (let i = 89; i >= 0; i--) {
    const s        = i * 11 + 7;
    const progress = (89 - i) / 89;

    const d = new Date(BASE_DATE);
    d.setDate(BASE_DATE.getDate() - i);
    const dateISO   = d.toISOString().split("T")[0];
    const dateLabel = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

    const investment = 800  + rng(s)     * 1400 + progress * 300;
    const cpl        = 65   - progress   * 22   + rng(s + 1) * 28;
    const leads      = Math.max(1, Math.round(investment / cpl));
    const mqls       = Math.max(0, Math.round(leads * (0.38 + rng(s + 2) * 0.28)));
    const convRate   = 0.18 - progress   * 0.05 + rng(s + 3) * 0.08;
    const sales      = Math.max(0, Math.round(leads * convRate));
    const avgTicket  = 1100 + rng(s + 4) * 900;
    const revenue    = sales * avgTicket;
    const impressions = Math.round(investment * (150 + rng(s + 5) * 100));
    const clicks     = Math.round(impressions * (0.015 + rng(s + 6) * 0.015));

    days.push({
      dateISO,
      dateLabel,
      leads,
      investment: Math.round(investment * 100) / 100,
      sales,
      mqls,
      revenue: Math.round(revenue),
      cpl: Math.round(cpl * 100) / 100,
      impressions,
      clicks,
    });
  }
  return days;
}

const RAW_DAYS = buildRawDays();

// ─── Lead records ─────────────────────────────────────────────────────────────

const SOURCES: LeadSource[]  = ["facebook", "instagram", "google", "organico"];
const QUALITIES: LeadQuality[] = ["mql", "nao_qualificado", "convertido"];
const SOURCE_WEIGHTS  = [0.44, 0.26, 0.22, 0.08];
const QUALITY_WEIGHTS = [0.45, 0.35, 0.20];

function weightedPick<T>(options: T[], weights: number[], rv: number): T {
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (rv < cumulative) return options[i];
  }
  return options[options.length - 1];
}

function buildLeadRecords(): LeadRecord[] {
  const records: LeadRecord[] = [];
  const recentDays = RAW_DAYS.slice(-60);
  recentDays.forEach((day, di) => {
    const count = Math.min(day.leads, 10);
    for (let li = 0; li < count; li++) {
      const s = di * 200 + li * 17 + 3;
      records.push({
        id:      `${day.dateISO}-${li}`,
        dateISO: day.dateISO,
        date:    day.dateLabel,
        source:  weightedPick(SOURCES,    SOURCE_WEIGHTS,  rng(s)),
        quality: weightedPick(QUALITIES,  QUALITY_WEIGHTS, rng(s + 1)),
        cpl:     Math.round(day.cpl * (0.75 + rng(s + 2) * 0.5) * 100) / 100,
      });
    }
  });
  return records.reverse();
}

const ALL_LEADS = buildLeadRecords();

// ─── Aggregation helpers ──────────────────────────────────────────────────────

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

function trendPct(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

function periodSlice(days: number) {
  return {
    current:  RAW_DAYS.slice(-days),
    previous: RAW_DAYS.slice(-days * 2, -days),
  };
}

// ─── Insights ─────────────────────────────────────────────────────────────────

function buildInsights(kpis: TrafficKPIs): TrafficInsight[] {
  const insights: TrafficInsight[] = [];
  const { trends } = kpis;
  const ROAS_TARGET = 3.0;
  const QUAL_TARGET = 50;

  if (Math.abs(trends.cpl) >= 5) {
    insights.push({
      id: "cpl",
      type: trends.cpl < 0 ? "positive" : "negative",
      title: trends.cpl < 0
        ? `CPL caiu ${Math.abs(trends.cpl).toFixed(0)}%`
        : `CPL subiu ${trends.cpl.toFixed(0)}%`,
      description: trends.cpl < 0
        ? "Custo por lead melhorou em relação ao período anterior. As campanhas estão mais eficientes."
        : "Custo por lead aumentou. Revise a segmentação e os criativos das campanhas ativas.",
      change: trends.cpl,
    });
  }

  if (Math.abs(trends.leads) >= 8) {
    insights.push({
      id: "leads-volume",
      type: trends.leads > 0 ? "positive" : "negative",
      title: trends.leads > 0
        ? `Leads cresceram ${trends.leads.toFixed(0)}%`
        : `Leads caíram ${Math.abs(trends.leads).toFixed(0)}%`,
      description: trends.leads > 0
        ? "Volume de captação acima do período anterior. Identifique os canais que estão impulsionando esse resultado e escale."
        : "Volume de captação abaixo do período anterior. Revise orçamento e criativos ativos.",
      change: trends.leads,
    });
  }

  if (trends.conversionToSales <= -4) {
    insights.push({
      id: "conv-drop",
      type: "warning",
      title: "Taxa de conversão piorou",
      description: `A conversão de leads em vendas caiu ${Math.abs(trends.conversionToSales).toFixed(1)}%. A qualidade dos leads pode estar caindo — revise a segmentação.`,
      change: trends.conversionToSales,
    });
  } else if (trends.conversionToSales >= 4) {
    insights.push({
      id: "conv-up",
      type: "positive",
      title: "Conversão melhorando",
      description: `A taxa de conversão subiu ${trends.conversionToSales.toFixed(1)}%. Leads de maior qualidade estão entrando no funil.`,
      change: trends.conversionToSales,
    });
  }

  insights.push({
    id: "roas",
    type: kpis.roas >= ROAS_TARGET ? "positive" : "warning",
    title: kpis.roas >= ROAS_TARGET
      ? `ROAS saudável: ${kpis.roas.toFixed(2)}x`
      : "ROAS abaixo da meta",
    description: kpis.roas >= ROAS_TARGET
      ? `Retorno sobre investimento em ${kpis.roas.toFixed(2)}x, acima da meta de ${ROAS_TARGET}x.`
      : `ROAS atual de ${kpis.roas.toFixed(2)}x está abaixo da meta de ${ROAS_TARGET}x. Revise campanhas com menor retorno.`,
  });

  if (kpis.qualificationRate < QUAL_TARGET) {
    insights.push({
      id: "qual-low",
      type: "warning",
      title: "Taxa de qualificação baixa",
      description: `Apenas ${kpis.qualificationRate.toFixed(0)}% dos leads são MQL. Refine a segmentação para atrair perfis mais próximos ao ICP.`,
    });
  } else {
    insights.push({
      id: "qual-ok",
      type: "positive",
      title: "Qualidade de leads saudável",
      description: `${kpis.qualificationRate.toFixed(0)}% dos leads são qualificados (MQL), acima da referência de ${QUAL_TARGET}%.`,
    });
  }

  insights.push({
    id: "best-channel",
    type: "neutral",
    title: "Melhor canal do período: Google Ads",
    description: "Google Ads gerou o maior ROAS entre os canais ativos, com CPL 22% abaixo da média dos demais canais.",
  });

  return insights;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface TrafficData {
  kpis: TrafficKPIs;
  chartData: TrafficPoint[];
  leads: LeadRecord[];
  insights: TrafficInsight[];
}

export function useTrafficData(period: TrafficPeriod): TrafficData {
  return useMemo(() => {
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const { current, previous } = periodSlice(days);

    const investment  = sum(current.map(d => d.investment));
    const leads       = sum(current.map(d => d.leads));
    const sales       = sum(current.map(d => d.sales));
    const mqls        = sum(current.map(d => d.mqls));
    const revenue     = sum(current.map(d => d.revenue));
    const impressions = sum(current.map(d => d.impressions));
    const clicks      = sum(current.map(d => d.clicks));

    const cpl      = leads       > 0 ? investment / leads                        : 0;
    const cpm      = impressions > 0 ? (investment / impressions) * 1000          : 0;
    const ctr      = impressions > 0 ? (clicks / impressions) * 100               : 0;
    const cac      = sales       > 0 ? investment / sales                        : 0;
    const roas     = investment  > 0 ? revenue / investment                      : 0;
    const roi      = investment  > 0 ? ((revenue - investment) / investment) * 100 : 0;
    const qualRate = leads       > 0 ? (mqls  / leads) * 100                     : 0;
    const convRate = leads       > 0 ? (sales / leads) * 100                     : 0;

    const pInvestment  = sum(previous.map(d => d.investment));
    const pLeads       = sum(previous.map(d => d.leads));
    const pSales       = sum(previous.map(d => d.sales));
    const pMqls        = sum(previous.map(d => d.mqls));
    const pRevenue     = sum(previous.map(d => d.revenue));
    const pImpressions = sum(previous.map(d => d.impressions));
    const pClicks      = sum(previous.map(d => d.clicks));

    const pCpl  = pLeads       > 0 ? pInvestment / pLeads                            : 0;
    const pCpm  = pImpressions > 0 ? (pInvestment / pImpressions) * 1000             : 0;
    const pCtr  = pImpressions > 0 ? (pClicks / pImpressions) * 100                  : 0;
    const pCac  = pSales       > 0 ? pInvestment / pSales                            : 0;
    const pRoas = pInvestment  > 0 ? pRevenue / pInvestment                          : 0;
    const pRoi  = pInvestment  > 0 ? ((pRevenue - pInvestment) / pInvestment) * 100  : 0;
    const pQual = pLeads       > 0 ? (pMqls  / pLeads) * 100                         : 0;
    const pConv = pLeads       > 0 ? (pSales / pLeads) * 100                         : 0;

    const kpis: TrafficKPIs = {
      investment, leads, cpl, cpm, ctr,
      mqls, qualificationRate: qualRate, conversionToSales: convRate,
      revenue, cac, roas, roi,
      trends: {
        investment:        trendPct(investment, pInvestment),
        leads:             trendPct(leads,      pLeads),
        cpl:               trendPct(cpl,        pCpl),
        cpm:               trendPct(cpm,        pCpm),
        ctr:               trendPct(ctr,        pCtr),
        mqls:              trendPct(mqls,       pMqls),
        qualificationRate: trendPct(qualRate,   pQual),
        conversionToSales: trendPct(convRate,   pConv),
        revenue:           trendPct(revenue,    pRevenue),
        cac:               trendPct(cac,        pCac),
        roas:              trendPct(roas,        pRoas),
        roi:               trendPct(roi,        pRoi),
      },
    };

    const avgGoalLeads = Math.round((leads / days) * 1.2);

    const chartData: TrafficPoint[] = current.map((day, i) => ({
      date:       day.dateLabel,
      leads:      day.leads,
      investment: Math.round(day.investment),
      cpl:        Math.round(day.cpl),
      sales:      day.sales,
      mqls:       day.mqls,
      revenue:    day.revenue,
      prevLeads:  previous[i]?.leads ?? 0,
      goalLeads:  avgGoalLeads,
    }));

    const cutoffISO = current[0]?.dateISO ?? "";
    const filteredLeads = ALL_LEADS.filter(l => l.dateISO >= cutoffISO);

    return { kpis, chartData, leads: filteredLeads, insights: buildInsights(kpis) };
  }, [period]);
}
