"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Users } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { sellerRepository, entryRepository } from "@/lib/storage";
import { type DailyEntry } from "@/types/daily-entry";

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

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

function rangeForDays(days: number): { from: string; to: string } {
  const today = new Date();
  const from  = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  return { from: toISO(from), to: toISO(today) };
}

function prevRange(days: number): { from: string; to: string } {
  const today = new Date();
  const to    = new Date(today);
  to.setDate(to.getDate() - days);
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  return { from: toISO(from), to: toISO(to) };
}

const RANK_STYLES = [
  "bg-amber-400 text-white",
  "bg-gray-300 text-gray-700",
  "bg-amber-700/70 text-white",
];

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ hasSellers }: { hasSellers: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
        <Users size={20} className="text-gray-300" strokeWidth={1.5} />
      </div>
      <div className="text-center">
        {hasSellers ? (
          <>
            <p className="text-sm font-medium text-gray-500">Sem dados de vendas</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Preencha o Input Diário com distribuição por vendedor
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-500">Nenhum vendedor cadastrado</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Configure seu time para ver o ranking
            </p>
          </>
        )}
      </div>
      <Link
        href={hasSellers ? "/input" : "/sellers"}
        className="text-xs font-semibold text-green-600 hover:text-green-700 transition-colors"
      >
        {hasSellers ? "Preencher agora →" : "Configurar equipe →"}
      </Link>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function SellerRanking() {
  const [rows, setRows] = useState<
    { id: string; name: string; initials: string; revenue: number; sales: number; trend: number }[]
  >([]);
  const [hasSellers, setHasSellers] = useState(false);

  useEffect(() => {
    function load() {
      const sellers = sellerRepository.listActive();
      setHasSellers(sellers.length > 0);

      const { from, to }   = rangeForDays(30);
      const { from: pf, to: pt } = prevRange(30);

      const allEntries = entryRepository.list();
      const cur  = sumBySeller(allEntries, from, to);
      const prev = sumBySeller(allEntries, pf, pt);

      const ranked = sellers
        .map((s) => {
          const c = cur.get(s.id)  ?? { sales: 0, revenue: 0 };
          const p = prev.get(s.id) ?? { sales: 0, revenue: 0 };
          const trend =
            p.revenue > 0
              ? ((c.revenue - p.revenue) / p.revenue) * 100
              : c.revenue > 0
              ? 100
              : 0;
          const initials = s.name
            .split(" ").slice(0, 2)
            .map((w) => w[0]).join("").toUpperCase();
          return { id: s.id, name: s.name, initials, revenue: c.revenue, sales: c.sales, trend };
        })
        .filter((r) => r.revenue > 0 || r.sales > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .map((r, i) => ({ ...r, rank: i + 1 }));

      setRows(ranked as typeof rows);
    }

    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100/80 flex flex-col h-full"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)" }}
    >
      <div className="px-5 pt-5 pb-4 border-b border-gray-50">
        <p className="text-sm font-semibold text-gray-900">Ranking de Vendedores</p>
        <p className="text-xs text-gray-400 mt-0.5">Por receita nos últimos 30 dias</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState hasSellers={hasSellers} />
      ) : (
        <div className="flex flex-col divide-y divide-gray-50">
          {rows.map((s, i) => (
            <div
              key={s.id}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors"
            >
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0",
                  RANK_STYLES[i] ?? "bg-gray-100 text-gray-500",
                )}
              >
                {i + 1}
              </div>

              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-[11px] font-bold text-gray-500">{s.initials}</span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                <p className="text-xs text-gray-400">{s.sales} venda{s.sales !== 1 ? "s" : ""}</p>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-gray-900">{formatBRL(s.revenue)}</p>
                <div
                  className={cn(
                    "inline-flex items-center gap-0.5 text-[10px] font-semibold",
                    s.trend > 0 ? "text-green-600" : s.trend < 0 ? "text-red-500" : "text-gray-400",
                  )}
                >
                  {s.trend > 0 ? (
                    <TrendingUp size={10} strokeWidth={2.5} />
                  ) : s.trend < 0 ? (
                    <TrendingDown size={10} strokeWidth={2.5} />
                  ) : null}
                  {s.trend > 0 ? "+" : ""}{s.trend.toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
