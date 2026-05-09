"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, ChevronUp, ChevronDown, Pencil, Trash2, Plus, FileX } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeMetrics, type DailyEntry } from "@/types/daily-entry";
import { entryRepository, sellerRepository, type Seller } from "@/lib/storage";
import { EntryModal } from "@/components/entry-modal";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function formatBRLShort(v: number) {
  if (!isFinite(v) || v === 0) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1000)      return `R$ ${(v / 1000).toFixed(1)}k`;
  return formatBRL(v);
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
}

function todayISO() { return new Date().toISOString().split("T")[0]; }

function shiftDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function toISO(d: Date) { return d.toISOString().split("T")[0]; }

// ─── Types ────────────────────────────────────────────────────────────────────

type PeriodFilter = "all" | "7d" | "30d" | "month";
type SortKey = "date" | "investment" | "leads" | "sales" | "revenue" | "cpl" | "conversion" | "roas";
type SortDir = "asc" | "desc";

interface Row {
  entry: DailyEntry;
  sellerName: string | null;
  cpl: number;
  conversion: number;
  roas: number;
  avgTicket: number;
}

// ─── Period pill ──────────────────────────────────────────────────────────────

function PeriodBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-8 px-3.5 rounded-lg text-xs font-semibold transition-all",
        active
          ? "bg-gray-900 text-white"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
      )}
    >
      {children}
    </button>
  );
}

// ─── Sort header ──────────────────────────────────────────────────────────────

function SortTh({
  label, sortKey, current, dir, onSort, align = "left",
}: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir;
  onSort: (k: SortKey) => void; align?: "left" | "right";
}) {
  const active = current === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={cn(
        "px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-gray-600 transition-colors",
        align === "right" && "text-right",
      )}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={cn("transition-opacity", active ? "opacity-100" : "opacity-0 group-hover:opacity-50")}>
          {active && dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </span>
    </th>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SalesRecords() {
  const [entries,  setEntries]  = useState<DailyEntry[]>([]);
  const [sellers,  setSellers]  = useState<Seller[]>([]);
  const [search,   setSearch]   = useState("");
  const [period,   setPeriod]   = useState<PeriodFilter>("30d");
  const [sortKey,  setSortKey]  = useState<SortKey>("date");
  const [sortDir,  setSortDir]  = useState<SortDir>("desc");
  const [editEntry, setEditEntry] = useState<DailyEntry | null>(null);
  const [newDate,   setNewDate]   = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  function load() {
    setEntries(entryRepository.list());
    setSellers(sellerRepository.listActive());
  }

  useEffect(() => {
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  const sellerMap = useMemo(
    () => new Map(sellers.map(s => [s.id, s.name])),
    [sellers],
  );

  // Period date bounds
  const periodBounds = useMemo((): { from: string; to: string } | null => {
    const today = new Date();
    if (period === "all") return null;
    if (period === "7d")  return { from: toISO(shiftDays(today, -6)), to: toISO(today) };
    if (period === "30d") return { from: toISO(shiftDays(today, -29)), to: toISO(today) };
    const y = today.getFullYear(), m = today.getMonth() + 1;
    return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: toISO(today) };
  }, [period]);

  const rows: Row[] = useMemo(() => {
    let filtered = entries;

    if (periodBounds) {
      filtered = filtered.filter(e => e.date >= periodBounds.from && e.date <= periodBounds.to);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(e => {
        const sellerName = e.sellerId ? (sellerMap.get(e.sellerId) ?? "") : "";
        return e.date.includes(q) || sellerName.toLowerCase().includes(q);
      });
    }

    const mapped: Row[] = filtered.map(entry => {
      const m = computeMetrics(entry.investment, entry.leads, entry.sales, entry.revenue);
      return {
        entry,
        sellerName: entry.sellerId ? (sellerMap.get(entry.sellerId) ?? null) : null,
        cpl: m.cpl,
        conversion: m.conversionRate,
        roas: m.roas,
        avgTicket: m.avgTicket,
      };
    });

    return mapped.sort((a, b) => {
      let av = 0, bv = 0;
      switch (sortKey) {
        case "date":       av = a.entry.date.localeCompare(b.entry.date); break;
        case "investment": av = a.entry.investment; bv = b.entry.investment; break;
        case "leads":      av = a.entry.leads;      bv = b.entry.leads;      break;
        case "sales":      av = a.entry.sales;      bv = b.entry.sales;      break;
        case "revenue":    av = a.entry.revenue;    bv = b.entry.revenue;    break;
        case "cpl":        av = a.cpl;              bv = b.cpl;              break;
        case "conversion": av = a.conversion;       bv = b.conversion;       break;
        case "roas":       av = a.roas;             bv = b.roas;             break;
      }
      if (sortKey === "date") return sortDir === "asc" ? av : -av;
      const diff = av - bv;
      return sortDir === "asc" ? diff : -diff;
    });
  }, [entries, periodBounds, search, sellerMap, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function handleSave(data: Omit<DailyEntry, "id" | "createdAt" | "updatedAt">, entryId?: string) {
    if (entryId) entryRepository.update(entryId, data);
    else entryRepository.create(data);
    window.dispatchEvent(new Event("storage"));
    load();
    setEditEntry(null);
    setNewDate(null);
  }

  function handleDelete(id: string) {
    entryRepository.remove(id);
    window.dispatchEvent(new Event("storage"));
    load();
    setConfirmDel(null);
  }

  // Totals row
  const totals = useMemo(() => {
    const t = rows.reduce(
      (acc, r) => ({
        investment: acc.investment + r.entry.investment,
        leads:      acc.leads      + r.entry.leads,
        sales:      acc.sales      + r.entry.sales,
        revenue:    acc.revenue    + r.entry.revenue,
      }),
      { investment: 0, leads: 0, sales: 0, revenue: 0 },
    );
    const m = computeMetrics(t.investment, t.leads, t.sales, t.revenue);
    return { ...t, cpl: m.cpl, conversion: m.conversionRate, roas: m.roas };
  }, [rows]);

  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" strokeWidth={2} />
          <input
            type="text"
            placeholder="Buscar por data ou vendedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-green-300 focus:shadow-[0_0_0_3px_rgba(90,137,119,0.08)] transition-all"
          />
        </div>

        {/* Period */}
        <div className="flex items-center gap-1 bg-gray-100/80 rounded-xl p-1">
          <PeriodBtn active={period === "all"}   onClick={() => setPeriod("all")}>Todos</PeriodBtn>
          <PeriodBtn active={period === "7d"}    onClick={() => setPeriod("7d")}>7 dias</PeriodBtn>
          <PeriodBtn active={period === "30d"}   onClick={() => setPeriod("30d")}>30 dias</PeriodBtn>
          <PeriodBtn active={period === "month"} onClick={() => setPeriod("month")}>Este mês</PeriodBtn>
        </div>

        <div className="ml-auto">
          <button
            onClick={() => setNewDate(todayISO())}
            className="flex items-center gap-2 h-9 px-4 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 active:scale-[0.99] transition-all shadow-[0_4px_14px_rgba(90,137,119,0.25)]"
          >
            <Plus size={14} strokeWidth={2.5} />
            Novo registro
          </button>
        </div>
      </div>

      {/* Table */}
      <div
        className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)" }}
      >
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
              <FileX size={24} className="text-gray-200" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-semibold text-gray-400">Nenhum registro encontrado</p>
            <p className="text-xs text-gray-300">Ajuste o filtro ou adicione um novo registro</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <SortTh label="Data"         sortKey="date"       current={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-left">Vendedor</th>
                  <SortTh label="Investimento" sortKey="investment" current={sortKey} dir={sortDir} onSort={handleSort} align="right" />
                  <SortTh label="Leads"        sortKey="leads"      current={sortKey} dir={sortDir} onSort={handleSort} align="right" />
                  <SortTh label="Vendas"       sortKey="sales"      current={sortKey} dir={sortDir} onSort={handleSort} align="right" />
                  <SortTh label="Faturamento"  sortKey="revenue"    current={sortKey} dir={sortDir} onSort={handleSort} align="right" />
                  <SortTh label="CPL"          sortKey="cpl"        current={sortKey} dir={sortDir} onSort={handleSort} align="right" />
                  <SortTh label="Conv."        sortKey="conversion" current={sortKey} dir={sortDir} onSort={handleSort} align="right" />
                  <SortTh label="ROAS"         sortKey="roas"       current={sortKey} dir={sortDir} onSort={handleSort} align="right" />
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(({ entry, sellerName, cpl, conversion, roas }) => (
                  <tr key={entry.id} className="hover:bg-gray-50/60 transition-colors group">
                    <td className="px-4 py-3.5 text-sm font-medium text-gray-700 whitespace-nowrap">
                      {formatDate(entry.date)}
                    </td>
                    <td className="px-4 py-3.5">
                      {sellerName ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-full bg-green-50 border border-green-100 flex items-center justify-center text-[9px] font-bold text-green-700 flex-shrink-0">
                            {sellerName.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-700 font-medium truncate max-w-[120px]">{sellerName}</span>
                        </span>
                      ) : (
                        <span className="text-sm text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-700 text-right font-medium tabular-nums">
                      {formatBRLShort(entry.investment)}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-700 text-right tabular-nums">{entry.leads}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-700 text-right tabular-nums">{entry.sales}</td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-gray-900 text-right tabular-nums">
                      {formatBRLShort(entry.revenue)}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-500 text-right tabular-nums">
                      {cpl > 0 ? formatBRLShort(cpl) : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      <span className={cn(
                        "text-sm font-medium",
                        conversion >= 20 ? "text-green-600" : conversion >= 10 ? "text-gray-700" : "text-red-400",
                      )}>
                        {conversion > 0 ? `${conversion.toFixed(1)}%` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      <span className={cn(
                        "text-sm font-medium",
                        roas >= 3 ? "text-green-600" : roas >= 1.5 ? "text-gray-700" : "text-red-400",
                      )}>
                        {roas > 0 ? `${roas.toFixed(2)}x` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditEntry(entry)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all"
                        >
                          <Pencil size={12} strokeWidth={2} />
                        </button>
                        {confirmDel === entry.id ? (
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="h-7 px-2 rounded-lg bg-red-50 text-[11px] font-bold text-red-500 hover:bg-red-100 transition-all"
                          >
                            Confirmar
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmDel(entry.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:bg-red-50 hover:text-red-400 transition-all"
                          >
                            <Trash2 size={12} strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Totals footer */}
              {rows.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-100 bg-gray-50">
                    <td className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider" colSpan={2}>
                      Total · {rows.length} registros
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right tabular-nums">{formatBRLShort(totals.investment)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right tabular-nums">{totals.leads}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right tabular-nums">{totals.sales}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right tabular-nums">{formatBRLShort(totals.revenue)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right tabular-nums">{totals.cpl > 0 ? formatBRLShort(totals.cpl) : "—"}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right tabular-nums">{totals.conversion > 0 ? `${totals.conversion.toFixed(1)}%` : "—"}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right tabular-nums">{totals.roas > 0 ? `${totals.roas.toFixed(2)}x` : "—"}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {editEntry && (
        <EntryModal
          key={editEntry.id}
          date={editEntry.date}
          entry={editEntry}
          sellers={sellers}
          onClose={() => setEditEntry(null)}
          onSave={handleSave}
        />
      )}
      {newDate && (
        <EntryModal
          key={`new-${newDate}`}
          date={newDate}
          entry={null}
          sellers={sellers}
          onClose={() => setNewDate(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
