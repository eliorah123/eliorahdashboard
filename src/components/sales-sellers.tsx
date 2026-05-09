"use client";

import { useState, useEffect, useMemo } from "react";
import { TrendingUp, TrendingDown, Users, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { sellerRepository, entryRepository, type Seller } from "@/lib/storage";
import { type DailyEntry } from "@/types/daily-entry";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function formatBRLShort(v: number) {
  if (v === 0) return "—";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000)      return `R$ ${(v / 1000).toFixed(1)}k`;
  return formatBRL(v);
}

function toISO(d: Date) { return d.toISOString().split("T")[0]; }

function shiftDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function getRange(period: "7d" | "30d" | "month"): { from: string; to: string } {
  const today = new Date();
  if (period === "7d")  return { from: toISO(shiftDays(today, -6)), to: toISO(today) };
  if (period === "30d") return { from: toISO(shiftDays(today, -29)), to: toISO(today) };
  const y = today.getFullYear(), m = today.getMonth() + 1;
  return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: toISO(today) };
}

function getPrevRange(period: "7d" | "30d" | "month"): { from: string; to: string } {
  const today = new Date();
  if (period === "7d") {
    const to = toISO(shiftDays(today, -7));
    return { from: toISO(shiftDays(today, -13)), to };
  }
  if (period === "30d") {
    const to = toISO(shiftDays(today, -30));
    return { from: toISO(shiftDays(today, -59)), to };
  }
  // prev month
  const d  = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const y  = d.getFullYear(), m = d.getMonth() + 1;
  const daysInMonth = new Date(y, m, 0).getDate();
  return {
    from: `${y}-${String(m).padStart(2, "0")}-01`,
    to:   `${y}-${String(m).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`,
  };
}

function sumBySeller(
  entries: DailyEntry[],
  from: string,
  to: string,
): Map<string, { sales: number; revenue: number }> {
  const map = new Map<string, { sales: number; revenue: number }>();
  for (const e of entries) {
    if (!e.sellerId || e.date < from || e.date > to) continue;
    const p = map.get(e.sellerId) ?? { sales: 0, revenue: 0 };
    map.set(e.sellerId, { sales: p.sales + e.sales, revenue: p.revenue + e.revenue });
  }
  return map;
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

const RANK_COLORS = [
  "bg-amber-400 text-white border-amber-300",
  "bg-slate-300 text-slate-700 border-slate-200",
  "bg-amber-700/70 text-white border-amber-600/50",
];

// ─── Period button ────────────────────────────────────────────────────────────

function PBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn(
      "h-8 px-3.5 rounded-lg text-xs font-semibold transition-all",
      active ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
    )}>
      {children}
    </button>
  );
}

// ─── Seller row ───────────────────────────────────────────────────────────────

interface SellerRow {
  id: string;
  name: string;
  revenue: number;
  sales: number;
  avgTicket: number;
  share: number;
  trend: number;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SalesSellers() {
  const [sellers,  setSellers]  = useState<Seller[]>([]);
  const [period,   setPeriod]   = useState<"7d" | "30d" | "month">("30d");
  const [rows,     setRows]     = useState<SellerRow[]>([]);
  const [totalRev, setTotalRev] = useState(0);

  useEffect(() => {
    function load() {
      const allSellers = sellerRepository.listActive();
      setSellers(allSellers);

      const { from, to }          = getRange(period);
      const { from: pf, to: pt }  = getPrevRange(period);

      // Derive seller stats directly from entries — avoids sellerStatsRepository sync bugs
      const allEntries = entryRepository.list();
      const cur        = sumBySeller(allEntries, from, to);
      const prev       = sumBySeller(allEntries, pf, pt);

      const grandTotal = allEntries
        .filter(e => e.date >= from && e.date <= to)
        .reduce((s, e) => s + e.revenue, 0);
      setTotalRev(grandTotal);

      const built: SellerRow[] = allSellers
        .map(s => {
          const c    = cur.get(s.id)  ?? { sales: 0, revenue: 0 };
          const p    = prev.get(s.id) ?? { sales: 0, revenue: 0 };
          const trend =
            p.revenue > 0 ? ((c.revenue - p.revenue) / p.revenue) * 100
            : c.revenue > 0 ? 100
            : 0;
          return {
            id:        s.id,
            name:      s.name,
            revenue:   c.revenue,
            sales:     c.sales,
            avgTicket: c.sales > 0 ? c.revenue / c.sales : 0,
            share:     grandTotal > 0 ? (c.revenue / grandTotal) * 100 : 0,
            trend,
          };
        })
        .filter(r => r.revenue > 0 || r.sales > 0)
        .sort((a, b) => b.revenue - a.revenue);

      setRows(built);
    }

    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, [period]);

  const hasSellers = sellers.length > 0;

  // Totals
  const totals = useMemo(() => ({
    revenue:   rows.reduce((s, r) => s + r.revenue, 0),
    sales:     rows.reduce((s, r) => s + r.sales, 0),
    avgTicket: rows.length > 0
      ? rows.reduce((s, r) => s + r.revenue, 0) / rows.reduce((s, r) => s + r.sales, 0)
      : 0,
  }), [rows]);

  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-1 bg-gray-100/80 rounded-xl p-1">
          <PBtn active={period === "7d"}    onClick={() => setPeriod("7d")}>7 dias</PBtn>
          <PBtn active={period === "30d"}   onClick={() => setPeriod("30d")}>30 dias</PBtn>
          <PBtn active={period === "month"} onClick={() => setPeriod("month")}>Este mês</PBtn>
        </div>
        <Link
          href="/sellers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ExternalLink size={12} strokeWidth={2} />
          Gerenciar equipe
        </Link>
      </div>

      {!hasSellers ? (
        /* Empty: no sellers */
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
            <Users size={24} className="text-gray-200" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-500">Nenhum vendedor cadastrado</p>
            <p className="text-xs text-gray-400 mt-1">Adicione vendedores para ver o ranking</p>
          </div>
          <Link
            href="/sellers"
            className="h-9 px-5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors flex items-center gap-2"
          >
            <Users size={14} strokeWidth={2} />
            Configurar equipe
          </Link>
        </div>
      ) : rows.length === 0 ? (
        /* Has sellers but no data */
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
            <TrendingUp size={24} className="text-gray-200" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold text-gray-400">Sem dados de vendas no período</p>
          <p className="text-xs text-gray-300">Registre vendas com vendedor associado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
          {/* Ranking table */}
          <div
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)" }}
          >
            <div className="px-6 pt-5 pb-4 border-b border-gray-50">
              <p className="text-sm font-semibold text-gray-900">Ranking por Faturamento</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {period === "7d" ? "Últimos 7 dias" : period === "30d" ? "Últimos 30 dias" : "Este mês"}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    <th className="px-5 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-left w-8">#</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-left">Vendedor</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-right">Faturamento</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-right">Vendas</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-right">Ticket Médio</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-right">Participação</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-right">vs Período Ant.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((row, i) => (
                    <tr key={row.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border flex-shrink-0",
                          RANK_COLORS[i] ?? "bg-gray-100 text-gray-500 border-gray-200",
                        )}>
                          {i + 1}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-[11px] font-bold text-green-700">{initials(row.name)}</span>
                          </div>
                          <p className="text-sm font-medium text-gray-800">{row.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-gray-900 text-right tabular-nums">
                        {formatBRL(row.revenue)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 text-right tabular-nums">
                        {row.sales}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 text-right tabular-nums">
                        {row.avgTicket > 0 ? formatBRLShort(row.avgTicket) : "—"}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-400 rounded-full"
                              style={{ width: `${Math.min(row.share, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-gray-600 tabular-nums w-10 text-right">
                            {row.share.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className={cn(
                          "inline-flex items-center gap-0.5 text-xs font-semibold",
                          row.trend > 0 ? "text-green-600" : row.trend < 0 ? "text-red-500" : "text-gray-400",
                        )}>
                          {row.trend > 0 ? <TrendingUp size={11} strokeWidth={2.5} /> : row.trend < 0 ? <TrendingDown size={11} strokeWidth={2.5} /> : null}
                          {row.trend !== 0 ? `${row.trend > 0 ? "+" : ""}${row.trend.toFixed(1)}%` : "—"}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {rows.length > 1 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-100 bg-gray-50">
                      <td colSpan={2} className="px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Total · {rows.length} vendedores
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right tabular-nums">{formatBRL(totals.revenue)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right tabular-nums">{totals.sales}</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right tabular-nums">
                        {totals.avgTicket > 0 && isFinite(totals.avgTicket) ? formatBRLShort(totals.avgTicket) : "—"}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Side: share chart */}
          <div
            className="bg-white rounded-2xl border border-gray-100 p-5"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)" }}
          >
            <p className="text-sm font-semibold text-gray-900 mb-1">Participação no Total</p>
            <p className="text-xs text-gray-400 mb-5">
              {totalRev > 0
                ? `Total: ${formatBRL(totalRev)}`
                : "Sem faturamento atribuído a vendedores"}
            </p>

            <div className="flex flex-col gap-3">
              {rows.map((row, i) => {
                const pct = totalRev > 0 ? (row.revenue / totalRev) * 100 : 0;
                const colors = ["bg-green-500","bg-indigo-500","bg-amber-400","bg-pink-500","bg-sky-500"];
                const color  = colors[i % colors.length];
                return (
                  <div key={row.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">{row.name}</span>
                      <span className="text-xs font-bold text-gray-900 tabular-nums">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-700", color)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 text-right">{formatBRL(row.revenue)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
