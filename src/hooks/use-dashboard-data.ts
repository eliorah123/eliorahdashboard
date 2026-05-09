"use client";

import { useState, useEffect, useMemo } from "react";
import { entryRepository, goalStorage, type MonthlyGoal } from "@/lib/storage";
import { computeMetrics, type DailyEntry } from "@/types/daily-entry";

// ─── Public types ──────────────────────────────────────────────────────────────

export type Period = "today" | "7d" | "30d" | "90d";

export interface KPIMetric {
  value: number;
  trend: number; // % change vs the equivalent previous period
}

export interface ChartPoint {
  date: string;
  revenue: number;
  target: number;    // daily revenue target derived from monthly goal
  prevPeriod: number; // same day one period-length ago
}

export interface DashboardData {
  // KPIs for the selected period
  revenue:        KPIMetric;
  investment:     KPIMetric;
  profit:         KPIMetric;
  roas:           KPIMetric;
  leads:          KPIMetric;
  sales:          KPIMetric;
  conversionRate: KPIMetric;
  avgTicket:      KPIMetric;

  // Chart
  chartData: ChartPoint[];

  // Current month totals (for goal progress — always the calendar month)
  monthRevenue: number;
  monthLeads:   number;
  monthSales:   number;

  // Monthly pace projection
  projection: number | null;

  // Goal for the current month (null if not set)
  goal: MonthlyGoal | null;

  hasData: boolean;
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

function shiftDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function filterRange(entries: DailyEntry[], from: string, to: string): DailyEntry[] {
  return entries.filter((e) => e.date >= from && e.date <= to);
}

function sum(entries: DailyEntry[]) {
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

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

function periodDays(p: Period): number {
  return p === "today" ? 1 : p === "7d" ? 7 : p === "30d" ? 30 : 90;
}

function dateRanges(period: Period) {
  const today = new Date();
  const to       = toISO(today);
  const days     = periodDays(period);
  const from     = toISO(shiftDays(today, -(days - 1)));
  const prevTo   = toISO(shiftDays(today, -days));
  const prevFrom = toISO(shiftDays(today, -(days * 2 - 1)));
  return { from, to, prevFrom, prevTo };
}

const SHORT_MONTHS = [
  "Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez",
];

function dateLabel(iso: string, totalDays: number): string {
  const [, m, d] = iso.split("-").map(Number);
  if (totalDays > 30) return `${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}`;
  return `${d} ${SHORT_MONTHS[m - 1]}`;
}

function buildChart(
  all: DailyEntry[],
  from: string,
  to: string,
  dailyTarget: number,
): ChartPoint[] {
  // Aggregate multiple entries per date (multi-record model)
  const revenueByDate = new Map<string, number>();
  for (const e of all) {
    revenueByDate.set(e.date, (revenueByDate.get(e.date) ?? 0) + e.revenue);
  }

  const start = new Date(from + "T12:00:00");
  const end   = new Date(to   + "T12:00:00");
  const days  = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const points: ChartPoint[] = [];

  for (let i = 0; i < days; i++) {
    const cur     = shiftDays(start, i);
    const curStr  = toISO(cur);
    const prevStr = toISO(shiftDays(cur, -days));
    points.push({
      date:       dateLabel(curStr, days),
      revenue:    revenueByDate.get(curStr)    ?? 0,
      target:     dailyTarget,
      prevPeriod: revenueByDate.get(prevStr)   ?? 0,
    });
  }

  return points;
}

// ─── Pure computation ──────────────────────────────────────────────────────────

function compute(
  entries: DailyEntry[],
  period: Period,
  goal: MonthlyGoal | null,
): DashboardData {
  const { from, to, prevFrom, prevTo } = dateRanges(period);

  const cur  = sum(filterRange(entries, from, to));
  const prev = sum(filterRange(entries, prevFrom, prevTo));
  const cM   = computeMetrics(cur.investment,  cur.leads,  cur.sales,  cur.revenue);
  const pM   = computeMetrics(prev.investment, prev.leads, prev.sales, prev.revenue);

  // Calendar-month totals
  const today      = new Date();
  const y          = today.getFullYear();
  const mo         = today.getMonth() + 1;
  const monthStart = `${y}-${String(mo).padStart(2,"0")}-01`;
  const daysInMonth = new Date(y, mo, 0).getDate();
  const monthData  = sum(filterRange(entries, monthStart, toISO(today)));

  const projection = monthData.revenue > 0
    ? (monthData.revenue / today.getDate()) * daysInMonth
    : null;

  const dailyTarget = goal && goal.revenue > 0
    ? goal.revenue / daysInMonth
    : 0;

  // Chart always covers at least 14 days for visual depth
  const days       = periodDays(period);
  const chartFrom  = days < 14 ? toISO(shiftDays(today, -13)) : from;
  const chartData  = buildChart(entries, chartFrom, to, dailyTarget);

  return {
    revenue:        { value: cur.revenue,           trend: pctChange(cur.revenue,        prev.revenue) },
    investment:     { value: cur.investment,         trend: pctChange(cur.investment,     prev.investment) },
    profit:         { value: cM.profit,              trend: pctChange(cM.profit,          pM.profit) },
    roas:           { value: cM.roas,                trend: pctChange(cM.roas,            pM.roas) },
    leads:          { value: cur.leads,              trend: pctChange(cur.leads,          prev.leads) },
    sales:          { value: cur.sales,              trend: pctChange(cur.sales,          prev.sales) },
    conversionRate: { value: cM.conversionRate,      trend: pctChange(cM.conversionRate,  pM.conversionRate) },
    avgTicket:      { value: cM.avgTicket,           trend: pctChange(cM.avgTicket,       pM.avgTicket) },
    chartData,
    monthRevenue: monthData.revenue,
    monthLeads:   monthData.leads,
    monthSales:   monthData.sales,
    projection,
    goal,
    hasData: entries.length > 0,
  };
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useDashboardData(period: Period): DashboardData {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [goal,    setGoal   ] = useState<MonthlyGoal | null>(null);

  useEffect(() => {
    const today = new Date();
    const load  = () => {
      setEntries(entryRepository.list());
      setGoal(goalStorage.get(today.getFullYear(), today.getMonth() + 1));
    };
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  return useMemo(() => compute(entries, period, goal), [entries, period, goal]);
}
