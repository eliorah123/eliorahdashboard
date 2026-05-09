"use client";

import { useState, useEffect, useMemo } from "react";
import {
  X, Check, DollarSign, Users, ShoppingCart, TrendingUp,
  FileText, UserCircle, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { computeMetrics, parseCurrency, parseInteger, type DailyEntry } from "@/types/daily-entry";
import type { Seller } from "@/lib/storage";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRLShort(v: number) {
  if (!isFinite(v) || v === 0) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1000)      return `R$ ${(v / 1000).toFixed(1)}k`;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function formatDateLong(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

// ─── Field ────────────────────────────────────────────────────────────────────

export function Field({
  label, icon, prefix, value, onChange, onEnter,
  inputMode = "decimal", placeholder = "0", autoFocus = false,
}: {
  label: string; icon: React.ReactNode; prefix?: string;
  value: string; onChange: (v: string) => void; onEnter?: () => void;
  inputMode?: "decimal" | "numeric"; placeholder?: string; autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
        <span className="opacity-60">{icon}</span>{label}
      </label>
      <div className={cn(
        "flex items-center gap-2 h-12 px-3.5 rounded-xl border-2 transition-all",
        "bg-gray-50 border-transparent focus-within:bg-white focus-within:border-green-200 focus-within:shadow-[0_0_0_4px_rgba(90,137,119,0.07)]",
        value && "border-gray-100 bg-white",
      )}>
        {prefix && <span className="text-gray-400 font-semibold text-sm select-none">{prefix}</span>}
        <input
          type="text" inputMode={inputMode} autoComplete="off" autoFocus={autoFocus}
          placeholder={placeholder} value={value}
          onChange={e => onChange(inputMode === "numeric" ? e.target.value.replace(/\D/g, "") : e.target.value.replace(/[^0-9,.]/g, ""))}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onEnter?.(); } }}
          className="flex-1 min-w-0 bg-transparent text-base font-semibold text-gray-900 outline-none placeholder:text-gray-300"
        />
      </div>
    </div>
  );
}

// ─── MetricChip ───────────────────────────────────────────────────────────────

export function MetricChip({ label, value, positive, negative }: {
  label: string; value: string; positive?: boolean; negative?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 bg-gray-50 rounded-xl px-2.5 py-2.5 flex-1 min-w-0">
      <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      <span className={cn(
        "text-xs font-bold truncate",
        positive && "text-green-600",
        negative && "text-red-500",
        !positive && !negative && "text-gray-700",
      )}>{value}</span>
    </div>
  );
}

// ─── EntryModal ───────────────────────────────────────────────────────────────

export interface EntryModalProps {
  date: string;
  entry: DailyEntry | null;
  sellers: Seller[];
  onClose(): void;
  onSave(data: Omit<DailyEntry, "id" | "createdAt" | "updatedAt">, entryId?: string): void;
}

export function EntryModal({ date, entry, sellers, onClose, onSave }: EntryModalProps) {
  const [inv,      setInv]      = useState(entry?.investment ? String(entry.investment) : "");
  const [leads,    setLeads]    = useState(entry?.leads      ? String(entry.leads)      : "");
  const [sales,    setSales]    = useState(entry?.sales      ? String(entry.sales)      : "");
  const [rev,      setRev]      = useState(entry?.revenue    ? String(entry.revenue)    : "");
  const [sellerId, setSellerId] = useState(entry?.sellerId ?? "");
  const [notes,    setNotes]    = useState(entry?.notes ?? "");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const m = useMemo(() =>
    computeMetrics(parseCurrency(inv), parseInteger(leads), parseInteger(sales), parseCurrency(rev)),
    [inv, leads, sales, rev],
  );

  const isValid    = inv.trim() !== "" && leads.trim() !== "" && sales.trim() !== "" && rev.trim() !== "";
  const hasPreview = parseCurrency(inv) > 0 || parseCurrency(rev) > 0;

  function submit() {
    if (!isValid) return;
    onSave({
      date,
      investment: parseCurrency(inv),
      leads: parseInteger(leads),
      sales: parseInteger(sales),
      revenue: parseCurrency(rev),
      notes: notes.trim(),
      sellerId: sellerId || undefined,
    }, entry?.id);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(4px)", backgroundColor: "rgba(15,23,20,0.45)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[480px] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-[11px] font-bold text-green-600 uppercase tracking-wider mb-0.5">
              {entry ? "Editar registro" : "Novo registro"}
            </p>
            <h2 className="text-sm font-bold text-gray-900 capitalize">{formatDateLong(date)}</h2>
          </div>
          <button onClick={onClose} className="mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-all">
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Investimento" icon={<DollarSign size={11} strokeWidth={2.5} />} prefix="R$" value={inv} onChange={setInv} autoFocus />
            <Field label="Faturamento"  icon={<TrendingUp size={11} strokeWidth={2.5} />} prefix="R$" value={rev} onChange={setRev} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Leads"  icon={<Users size={11} strokeWidth={2.5} />}        inputMode="numeric" value={leads} onChange={setLeads} />
            <Field label="Vendas" icon={<ShoppingCart size={11} strokeWidth={2.5} />} inputMode="numeric" value={sales} onChange={setSales} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              <span className="opacity-60"><UserCircle size={11} strokeWidth={2.5} /></span>Vendedor
            </label>
            <div className={cn(
              "relative flex items-center h-12 px-3.5 rounded-xl border-2 transition-all",
              "bg-gray-50 border-transparent focus-within:bg-white focus-within:border-green-200",
              sellerId && "border-gray-100 bg-white",
            )}>
              <select
                value={sellerId} onChange={e => setSellerId(e.target.value)}
                disabled={sellers.length === 0}
                className={cn(
                  "flex-1 bg-transparent text-base font-semibold outline-none appearance-none cursor-pointer",
                  sellerId ? "text-gray-900" : "text-gray-400",
                  sellers.length === 0 && "cursor-not-allowed",
                )}
              >
                <option value="">{sellers.length === 0 ? "Sem vendedores cadastrados" : "Selecionar vendedor..."}</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <ChevronDown size={14} className="text-gray-400 pointer-events-none flex-shrink-0" strokeWidth={2} />
            </div>
            {sellers.length === 0 && (
              <p className="text-[11px] text-gray-400">Cadastre em <a href="/sellers" className="text-green-600 hover:underline font-medium">Vendedores</a></p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              <span className="opacity-60"><FileText size={11} strokeWidth={2.5} /></span>
              Observações <span className="font-normal normal-case text-gray-300">opcional</span>
            </label>
            <textarea
              rows={2} placeholder="Campanhas, ocorrências..." value={notes}
              onChange={e => setNotes(e.target.value)}
              className={cn(
                "w-full resize-none rounded-xl px-3.5 py-3 text-sm text-gray-900 border-2 transition-all outline-none",
                "bg-gray-50 border-transparent placeholder:text-gray-300",
                "focus:bg-white focus:border-green-200",
                notes && "border-gray-100 bg-white",
              )}
            />
          </div>

          {hasPreview && (
            <div className="flex gap-1.5">
              <MetricChip label="CPL"    value={m.cpl > 0            ? formatBRLShort(m.cpl)             : "—"} />
              <MetricChip label="Conv."  value={m.conversionRate > 0 ? `${m.conversionRate.toFixed(1)}%` : "—"} />
              <MetricChip label="ROAS"   value={m.roas > 0           ? `${m.roas.toFixed(2)}x`           : "—"} positive={m.roas >= 3} />
              <MetricChip label="Ticket" value={m.avgTicket > 0      ? formatBRLShort(m.avgTicket)       : "—"} />
              <MetricChip label="Lucro"  value={formatBRLShort(m.profit)} positive={m.profit > 0} negative={m.profit < 0} />
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/40">
          <div className="flex gap-2.5">
            <button onClick={onClose} className="flex-1 h-11 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all">
              Cancelar
            </button>
            <button
              onClick={submit} disabled={!isValid}
              className={cn(
                "flex-1 h-11 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2",
                isValid
                  ? "bg-green-500 text-white hover:bg-green-600 active:scale-[0.99] shadow-[0_4px_14px_rgba(90,137,119,0.25)]"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed",
              )}
            >
              <Check size={14} strokeWidth={2.5} />
              {entry ? "Atualizar" : "Salvar registro"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
