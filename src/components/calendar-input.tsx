"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Check,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { computeMetrics, type DailyEntry } from "@/types/daily-entry";
import { entryRepository, sellerRepository, type Seller } from "@/lib/storage";
import { EntryModal, MetricChip } from "@/components/entry-modal";

// ─── Constants ────────────────────────────────────────────────────────────────

const PT_WEEKDAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const PT_MONTHS   = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().split("T")[0]; }

function isoFromYMD(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

function formatBRL(v: number) {
  if (!isFinite(v) || v === 0) return "—";
  return new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL", maximumFractionDigits:2 }).format(v);
}

function formatBRLShort(v: number) {
  if (!isFinite(v) || v === 0) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v/1_000_000).toFixed(1)}M`;
  if (abs >= 1000)      return `R$ ${(v/1000).toFixed(1)}k`;
  return new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL", maximumFractionDigits:0 }).format(v);
}

function formatDateLong(iso: string) {
  const [y,m,d] = iso.split("-").map(Number);
  return new Date(y,m-1,d).toLocaleDateString("pt-BR", { weekday:"long", day:"numeric", month:"long" });
}

function formatDateMedium(iso: string) {
  const [y,m,d] = iso.split("-").map(Number);
  return new Date(y,m-1,d).toLocaleDateString("pt-BR", { weekday:"short", day:"numeric", month:"short" });
}

// ─── Calendar grid ────────────────────────────────────────────────────────────

interface CalDay { iso:string; day:number; currentMonth:boolean; isToday:boolean; isFuture:boolean; }

function buildGrid(year: number, month: number): CalDay[] {
  const today        = todayISO();
  const firstWeekday = new Date(year, month-1, 1).getDay();
  const daysInMonth  = new Date(year, month, 0).getDate();
  const prevDays     = new Date(year, month-1, 0).getDate();
  const days: CalDay[] = [];

  for (let i = firstWeekday-1; i >= 0; i--) {
    const d = prevDays - i;
    const iso = isoFromYMD(month===1?year-1:year, month===1?12:month-1, d);
    days.push({ iso, day:d, currentMonth:false, isToday:iso===today, isFuture:iso>today });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = isoFromYMD(year, month, d);
    days.push({ iso, day:d, currentMonth:true, isToday:iso===today, isFuture:iso>today });
  }
  const rem = 7 - (days.length % 7);
  if (rem < 7) {
    for (let d = 1; d <= rem; d++) {
      const iso = isoFromYMD(month===12?year+1:year, month===12?1:month+1, d);
      days.push({ iso, day:d, currentMonth:false, isToday:iso===today, isFuture:iso>today });
    }
  }
  return days;
}

// ─── Entry Card ───────────────────────────────────────────────────────────────

interface EntryCardProps {
  entry: DailyEntry;
  sellerName: string | null;
  onEdit(): void;
  onDelete(): void;
}

function EntryCard({ entry, sellerName, onEdit, onDelete }: EntryCardProps) {
  const [confirmDel, setConfirmDel] = useState(false);
  const m        = computeMetrics(entry.investment, entry.leads, entry.sales, entry.revenue);
  const initials = sellerName
    ? sellerName.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase()
    : "–";

  return (
    <div className="bg-white rounded-2xl border border-gray-100"
      style={{ boxShadow:"0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)" }}>
      <div className="px-4 py-4">
        {/* Seller + revenue + actions */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-green-700">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{sellerName ?? "Sem vendedor"}</p>
            <p className="text-xs font-semibold text-gray-400">{formatBRL(entry.revenue)}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={onEdit}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all">
              <Pencil size={12} strokeWidth={2} />
            </button>
            {confirmDel ? (
              <button onClick={() => { setConfirmDel(false); onDelete(); }}
                className="h-7 px-2 rounded-lg bg-red-50 text-[11px] font-bold text-red-500 hover:bg-red-100 transition-all">
                Confirmar
              </button>
            ) : (
              <button onClick={() => setConfirmDel(true)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:bg-red-50 hover:text-red-400 transition-all">
                <Trash2 size={12} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        {/* Data grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { l:"Investimento", v:formatBRLShort(entry.investment) },
            { l:"Leads",        v:String(entry.leads) },
            { l:"Vendas",       v:String(entry.sales) },
          ].map(({ l, v }) => (
            <div key={l} className="bg-gray-50 rounded-xl px-3 py-2">
              <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wider">{l}</p>
              <p className="text-sm font-bold text-gray-800 mt-0.5">{v}</p>
            </div>
          ))}
        </div>

        {/* Metrics */}
        <div className="flex gap-1.5">
          <MetricChip label="ROAS"  value={m.roas>0           ? `${m.roas.toFixed(2)}x`           : "—"} positive={m.roas>=3} />
          <MetricChip label="CPL"   value={m.cpl>0            ? formatBRLShort(m.cpl)             : "—"} />
          <MetricChip label="Conv." value={m.conversionRate>0 ? `${m.conversionRate.toFixed(1)}%` : "—"} />
          <MetricChip label="Lucro" value={formatBRLShort(m.profit)} positive={m.profit>0} negative={m.profit<0} />
        </div>

        {entry.notes && (
          <div className="mt-2.5 px-3 py-2 bg-amber-50/60 rounded-xl border border-amber-100/60">
            <p className="text-[11px] text-gray-600 leading-relaxed">{entry.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Day Aggregate ────────────────────────────────────────────────────────────

function DayAggregate({ entries }: { entries: DailyEntry[] }) {
  const t = entries.reduce((acc,e) => ({
    investment: acc.investment + e.investment,
    revenue:    acc.revenue    + e.revenue,
    leads:      acc.leads      + e.leads,
    sales:      acc.sales      + e.sales,
  }), { investment:0, revenue:0, leads:0, sales:0 });
  const m = computeMetrics(t.investment, t.leads, t.sales, t.revenue);

  return (
    <div className="bg-gray-900 rounded-2xl px-4 py-4 mb-3">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Total · {entries.length} {entries.length===1?"registro":"registros"}
      </p>
      <div className="grid grid-cols-4 gap-3 mb-3">
        {[
          { l:"Investimento", v:formatBRLShort(t.investment) },
          { l:"Faturamento",  v:formatBRLShort(t.revenue) },
          { l:"Leads",        v:String(t.leads) },
          { l:"Vendas",       v:String(t.sales) },
        ].map(({ l, v }) => (
          <div key={l}>
            <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider">{l}</p>
            <p className="text-sm font-bold text-white mt-0.5">{v}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        {[
          { l:"CPL",    v:m.cpl>0            ? formatBRLShort(m.cpl)             : "—", pos:false, neg:false },
          { l:"Conv.",  v:m.conversionRate>0 ? `${m.conversionRate.toFixed(1)}%` : "—", pos:false, neg:false },
          { l:"ROAS",   v:m.roas>0           ? `${m.roas.toFixed(2)}x`           : "—", pos:m.roas>=3, neg:false },
          { l:"Ticket", v:m.avgTicket>0      ? formatBRLShort(m.avgTicket)       : "—", pos:false, neg:false },
          { l:"Lucro",  v:formatBRLShort(m.profit),                                     pos:m.profit>0, neg:m.profit<0 },
        ].map(({ l, v, pos, neg }) => (
          <div key={l} className="flex flex-col items-center gap-0.5 bg-white/5 rounded-xl px-2 py-2 flex-1 min-w-0">
            <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">{l}</span>
            <span className={cn("text-xs font-bold truncate", pos&&"text-green-400", neg&&"text-red-400", !pos&&!neg&&"text-gray-300")}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Day Panel (right column) ─────────────────────────────────────────────────

interface DayPanelProps {
  selectedDate: string | null;
  dayEntries: DailyEntry[];
  sellerMap: Map<string, string>;
  onNewRecord(): void;
  onEditRecord(entry: DailyEntry): void;
  onDeleteRecord(id: string): void;
}

function DayPanel({ selectedDate, dayEntries, sellerMap, onNewRecord, onEditRecord, onDeleteRecord }: DayPanelProps) {
  if (!selectedDate) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-8 gap-3">
        <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-1">
          <CalendarDays size={24} className="text-gray-200" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-semibold text-gray-400">Selecione um dia</p>
        <p className="text-xs text-gray-300 leading-relaxed">
          Clique no calendário · duplo clique para novo registro direto
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-base font-bold text-gray-900 capitalize">{formatDateMedium(selectedDate)}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {dayEntries.length === 0
              ? "Nenhum registro"
              : `${dayEntries.length} ${dayEntries.length===1?"registro":"registros"}`}
          </p>
        </div>
        <button
          onClick={onNewRecord}
          className="flex items-center gap-2 h-9 px-4 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 active:scale-[0.99] transition-all shadow-[0_4px_14px_rgba(90,137,119,0.25)]"
        >
          <Plus size={14} strokeWidth={2.5} />
          Novo registro
        </button>
      </div>

      {dayEntries.length > 0 ? (
        <>
          <DayAggregate entries={dayEntries} />
          <div className="flex flex-col gap-2.5">
            {dayEntries.map(entry => (
              <EntryCard
                key={entry.id}
                entry={entry}
                sellerName={entry.sellerId ? (sellerMap.get(entry.sellerId) ?? null) : null}
                onEdit={() => onEditRecord(entry)}
                onDelete={() => onDeleteRecord(entry.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-12 bg-white rounded-2xl border border-dashed border-gray-200 text-center">
          <Plus size={20} className="text-gray-200" strokeWidth={1.5} />
          <div>
            <p className="text-sm font-semibold text-gray-500">Sem registros para este dia</p>
            <p className="text-xs text-gray-400 mt-0.5">Clique em "Novo registro" para começar</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CalendarInput({ embedded = false }: { embedded?: boolean }) {
  const now = new Date();
  const [viewYear,     setViewYear]     = useState(now.getFullYear());
  const [viewMonth,    setViewMonth]    = useState(now.getMonth()+1);
  const [selectedDate, setSelectedDate] = useState<string|null>(todayISO());
  const [modalState,   setModalState]   = useState<{ date:string; entry:DailyEntry|null }|null>(null);
  const [entries,      setEntries]      = useState<DailyEntry[]>([]);
  const [sellers,      setSellers]      = useState<Seller[]>([]);
  const [savedDate,    setSavedDate]    = useState<string|null>(null);

  function load() {
    setEntries(entryRepository.list());
    setSellers(sellerRepository.listActive());
  }

  useEffect(() => {
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  const entryMap = useMemo(() => {
    const map = new Map<string, DailyEntry[]>();
    for (const e of entries) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [entries]);

  const sellerMap  = useMemo(() => new Map(sellers.map(s=>[s.id,s.name])), [sellers]);
  const calDays    = useMemo(() => buildGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const dayEntries = useMemo(() =>
    (selectedDate ? (entryMap.get(selectedDate) ?? []) : [])
      .slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt)),
    [selectedDate, entryMap]
  );

  const monthPrefix     = `${viewYear}-${String(viewMonth).padStart(2,"0")}`;
  const filledThisMonth = [...entryMap.keys()].filter(k=>k.startsWith(monthPrefix)).length;

  function navigate(delta: number) {
    let m = viewMonth+delta, y = viewYear;
    if (m<1)  { m=12; y--; }
    if (m>12) { m=1;  y++; }
    setViewMonth(m); setViewYear(y);
  }

  function handleSave(data: Omit<DailyEntry,"id"|"createdAt"|"updatedAt">, entryId?: string) {
    if (entryId) {
      entryRepository.update(entryId, data);
    } else {
      entryRepository.create(data);
    }
    window.dispatchEvent(new Event("storage"));
    load();
    setModalState(null);
    setSavedDate(data.date);
    setTimeout(() => setSavedDate(null), 2500);
  }

  function handleDelete(id: string) {
    entryRepository.remove(id);
    window.dispatchEvent(new Event("storage"));
    load();
  }

  return (
    <>
      <div className="max-w-[1200px] mx-auto px-8 py-8">
        {!embedded && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Input Diário</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Clique para selecionar · duplo clique para novo registro
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[500px_1fr] gap-8 items-start">

          {/* ── Left: Calendar ───────────────────────────────────────── */}
          <div className={embedded ? "lg:sticky lg:top-[60px]" : "lg:sticky lg:top-8"}>
            <div className="bg-white rounded-2xl border border-gray-100"
              style={{ boxShadow:"0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.07)" }}>

              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <button onClick={()=>navigate(-1)} className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all">
                  <ChevronLeft size={18} strokeWidth={2} />
                </button>
                <div className="text-center">
                  <p className="text-base font-bold text-gray-900">{PT_MONTHS[viewMonth-1]} {viewYear}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {filledThisMonth} {filledThisMonth===1?"dia preenchido":"dias preenchidos"} este mês
                  </p>
                </div>
                <button onClick={()=>navigate(1)} className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all">
                  <ChevronRight size={18} strokeWidth={2} />
                </button>
              </div>

              <div className="grid grid-cols-7 px-5 pt-4 pb-2">
                {PT_WEEKDAYS.map(wd=>(
                  <div key={wd} className="flex items-center justify-center">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{wd}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 px-5 pb-5 gap-1.5">
                {calDays.map(day => {
                  const sel       = day.iso===selectedDate;
                  const has       = entryMap.has(day.iso);
                  const count     = entryMap.get(day.iso)?.length ?? 0;
                  const justSaved = day.iso===savedDate;

                  return (
                    <button key={day.iso}
                      onClick={()=>setSelectedDate(day.iso)}
                      onDoubleClick={()=>{ setSelectedDate(day.iso); setModalState({ date:day.iso, entry:null }); }}
                      disabled={day.isFuture && day.currentMonth}
                      className={cn(
                        "relative flex flex-col items-center justify-center h-[54px] w-full rounded-2xl transition-all duration-150 select-none",
                        !day.currentMonth && "opacity-20",
                        day.isFuture && day.currentMonth && "opacity-40 cursor-default pointer-events-none",
                        !sel && !day.isFuture && day.currentMonth && "hover:bg-gray-100/80",
                        sel && "bg-green-500 shadow-[0_4px_14px_rgba(90,137,119,0.35)]",
                        day.isToday && !sel && "ring-2 ring-green-300/70",
                      )}>
                      <span className={cn("text-sm font-semibold leading-none",
                        sel?"text-white":"text-gray-700",
                        day.isToday&&!sel&&"text-green-600 font-bold")}>
                        {day.day}
                      </span>
                      {has && count===1 && (
                        <span className={cn("absolute bottom-[5px] w-[5px] h-[5px] rounded-full",
                          sel?"bg-green-200":"bg-green-500", justSaved&&!sel&&"scale-150")} />
                      )}
                      {has && count>1 && (
                        <span className={cn("absolute bottom-[4px] text-[8px] font-bold",
                          sel?"text-green-200":"text-green-600")}>
                          {count}
                        </span>
                      )}
                      {justSaved && sel && (
                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-300 flex items-center justify-center shadow-sm">
                          <Check size={8} strokeWidth={3} className="text-green-800" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="px-6 pb-4 flex items-center gap-5 border-t border-gray-50 pt-3.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-[5px] h-[5px] rounded-full bg-green-500" />
                  <span className="text-[10px] text-gray-400">Com dados</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-xl bg-green-500 opacity-80" />
                  <span className="text-[10px] text-gray-400">Selecionado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-xl ring-2 ring-green-300/70" />
                  <span className="text-[10px] text-gray-400">Hoje</span>
                </div>
                <span className="ml-auto text-[10px] text-gray-300">duplo clique → novo registro</span>
              </div>
            </div>
          </div>

          {/* ── Right: Day panel ─────────────────────────────────────── */}
          <DayPanel
            selectedDate={selectedDate}
            dayEntries={dayEntries}
            sellerMap={sellerMap}
            onNewRecord={() => setModalState({ date: selectedDate!, entry: null })}
            onEditRecord={entry => setModalState({ date: selectedDate!, entry })}
            onDeleteRecord={handleDelete}
          />
        </div>
      </div>

      {modalState && (
        <EntryModal
          key={`${modalState.date}-${modalState.entry?.id ?? "new"}`}
          date={modalState.date}
          entry={modalState.entry}
          sellers={sellers}
          onClose={() => setModalState(null)}
          onSave={handleSave}
        />
      )}
    </>
  );
}
