"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Target,
  Check,
  TrendingUp,
  Users,
  ShoppingCart,
  DollarSign,
} from "lucide-react";
import { goalStorage, entryRepository } from "@/lib/storage";
import { parseCurrency, parseInteger } from "@/types/daily-entry";
import { cn } from "@/lib/utils";

// ─── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatBRL(v: number): string {
  if (!isFinite(v) || v === 0) return "R$ 0";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

function formatBRLShort(v: number): string {
  if (!isFinite(v) || v === 0) return "—";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
}

// ─── Goal input field ──────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  icon: React.ReactNode;
  prefix?: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}

function GoalField({ label, icon, prefix, value, onChange, inputMode = "decimal" }: FieldProps) {
  const hasValue = value.trim() !== "";
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-widest">
        <span className="opacity-60">{icon}</span>
        {label}
      </label>
      <div
        className={cn(
          "flex items-center gap-2.5 h-[60px] px-4 rounded-xl border-2 transition-all duration-150",
          "bg-gray-50/80 border-transparent",
          "focus-within:bg-white focus-within:border-green-200",
          "focus-within:shadow-[0_0_0_4px_rgba(90,137,119,0.07)]",
          hasValue && "border-gray-100 bg-white",
        )}
      >
        {prefix && (
          <span className="text-gray-400 font-semibold text-base select-none flex-shrink-0">
            {prefix}
          </span>
        )}
        <input
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          placeholder="0"
          value={value}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(inputMode === "numeric" ? raw.replace(/\D/g, "") : raw.replace(/[^0-9,.]/g, ""));
          }}
          className="flex-1 min-w-0 bg-transparent text-xl font-semibold text-gray-900 outline-none placeholder:text-gray-300"
        />
      </div>
    </div>
  );
}

// ─── Preview pill ──────────────────────────────────────────────────────────────

function PreviewPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[72px] bg-gray-50 rounded-xl px-3 py-2.5">
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
        {label}
      </span>
      <span className="text-sm font-bold text-gray-700">{value}</span>
    </div>
  );
}

// ─── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({
  label,
  current,
  target,
  color,
  fmt,
}: {
  label: string;
  current: number;
  target: number;
  color: string;
  fmt: (v: number) => string;
}) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : null;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className="text-xs font-bold text-gray-900">
          {pct !== null ? `${pct.toFixed(1)}%` : "—"}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        {pct !== null && (
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: color }}
          />
        )}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] font-medium text-gray-500">{fmt(current)}</span>
        {target > 0 ? (
          <span className="text-[11px] text-gray-300">Meta {fmt(target)}</span>
        ) : (
          <span className="text-[11px] text-gray-300">Sem meta</span>
        )}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function GoalsForm({ embedded = false }: { embedded?: boolean }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [revenue, setRevenue] = useState("");
  const [leads, setLeads]     = useState("");
  const [sales, setSales]     = useState("");
  const [saved, setSaved]           = useState(false);
  const [isEditing, setIsEditing]   = useState(false);

  // Load existing goal when month/year changes
  useEffect(() => {
    const existing = goalStorage.get(year, month);
    if (existing) {
      setRevenue(existing.revenue > 0 ? String(existing.revenue) : "");
      setLeads(existing.leads > 0 ? String(existing.leads) : "");
      setSales(existing.sales > 0 ? String(existing.sales) : "");
      setIsEditing(true);
    } else {
      setRevenue("");
      setLeads("");
      setSales("");
      setIsEditing(false);
    }
    setSaved(false);
  }, [year, month]);

  // Entries for the selected month (to show progress)
  const monthEntries = useMemo(() => {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    return entryRepository.list().filter((e) => e.date.startsWith(prefix));
  }, [year, month]);

  const monthTotals = useMemo(
    () =>
      monthEntries.reduce(
        (acc, e) => ({
          revenue: acc.revenue + e.revenue,
          leads:   acc.leads   + e.leads,
          sales:   acc.sales   + e.sales,
        }),
        { revenue: 0, leads: 0, sales: 0 },
      ),
    [monthEntries],
  );

  const days      = daysInMonth(year, month);
  const revNum    = parseCurrency(revenue);
  const leadsNum  = parseInteger(leads);
  const salesNum  = parseInteger(sales);

  const hasAnyValue = revenue !== "" || leads !== "" || sales !== "";
  const isValid     = revenue.trim() !== "" && leads.trim() !== "" && sales.trim() !== "";

  // Month navigation bounds: allow up to 3 months ahead of today
  const maxOrdinal = now.getFullYear() * 12 + now.getMonth() + 3;
  const curOrdinal = year * 12 + (month - 1);
  const isAtMax = curOrdinal >= maxOrdinal;

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (isAtMax) return;
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  function handleSave() {
    if (!isValid) return;
    goalStorage.upsert({ year, month, revenue: revNum, leads: leadsNum, sales: salesNum });
    setIsEditing(true);
    setSaved(true);
    window.dispatchEvent(new Event("storage"));
  }

  const isCurrentOrPast =
    year < now.getFullYear() ||
    (year === now.getFullYear() && month <= now.getMonth() + 1);
  const hasProgress = monthEntries.length > 0 && isCurrentOrPast;
  const dayOfMonth  = year === now.getFullYear() && month === now.getMonth() + 1
    ? now.getDate()
    : days;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        {!embedded && (
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors mb-3"
            >
              <ArrowLeft size={13} strokeWidth={2.5} />
              Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Metas</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Defina os objetivos mensais do time
            </p>
          </div>
        )}

        {/* Month picker */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          {isEditing && !saved && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
              Editando
            </span>
          )}
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full">
              <Check size={10} strokeWidth={3} />
              Salvo
            </span>
          )}
          <div
            className="flex items-center gap-1 bg-white border border-gray-100 rounded-xl px-2 py-1.5"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
          >
            <button
              onClick={prevMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft size={15} strokeWidth={2.5} />
            </button>
            <span className="text-sm font-semibold text-gray-700 min-w-[130px] text-center capitalize">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button
              onClick={nextMonth}
              disabled={isAtMax}
              className={cn(
                "w-7 h-7 flex items-center justify-center rounded-lg transition-colors",
                isAtMax
                  ? "text-gray-200 cursor-not-allowed"
                  : "text-gray-400 hover:text-gray-700 hover:bg-gray-50",
              )}
            >
              <ChevronRight size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Form card */}
      <div
        className="bg-white rounded-2xl border border-gray-100/80 p-6"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)" }}
      >
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
            <Target size={14} className="text-green-600" strokeWidth={2.5} />
          </div>
          <p className="text-sm font-semibold text-gray-900">
            Metas —{" "}
            <span className="capitalize text-gray-500">
              {MONTH_NAMES[month - 1]} {year}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <GoalField
            label="Receita"
            icon={<TrendingUp size={12} strokeWidth={2.5} />}
            prefix="R$"
            value={revenue}
            onChange={setRevenue}
          />
          <GoalField
            label="Leads"
            icon={<Users size={12} strokeWidth={2.5} />}
            value={leads}
            onChange={setLeads}
            inputMode="numeric"
          />
          <GoalField
            label="Vendas"
            icon={<ShoppingCart size={12} strokeWidth={2.5} />}
            value={sales}
            onChange={setSales}
            inputMode="numeric"
          />
        </div>

        {/* Daily breakdown preview */}
        <div
          className={cn(
            "flex gap-2 mb-6 transition-opacity duration-300",
            hasAnyValue ? "opacity-100" : "opacity-30",
          )}
        >
          <PreviewPill
            label="Receita/dia"
            value={revNum > 0 ? formatBRLShort(revNum / days) : "—"}
          />
          <PreviewPill
            label="Leads/dia"
            value={leadsNum > 0 ? (leadsNum / days).toFixed(1) : "—"}
          />
          <PreviewPill
            label="Vendas/dia"
            value={salesNum > 0 ? (salesNum / days).toFixed(1) : "—"}
          />
          <PreviewPill
            label="Conversão"
            value={
              leadsNum > 0 && salesNum > 0
                ? `${((salesNum / leadsNum) * 100).toFixed(1)}%`
                : "—"
            }
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!isValid}
          className={cn(
            "w-full h-14 rounded-xl text-base font-semibold transition-all duration-150",
            isValid
              ? "bg-green-500 text-white hover:bg-green-600 active:scale-[0.99] shadow-[0_4px_14px_rgba(90,137,119,0.3)]"
              : "bg-gray-100 text-gray-400 cursor-not-allowed",
          )}
        >
          {isEditing && !saved ? "Atualizar Meta" : "Salvar Meta"}
        </button>
      </div>

      {/* Progress section */}
      {hasProgress && (
        <div
          className="mt-5 bg-white rounded-2xl border border-gray-100/80 p-5"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)" }}
        >
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Realizado vs Meta</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {dayOfMonth} de {days} dias ·{" "}
                {monthEntries.length} registro{monthEntries.length !== 1 ? "s" : ""}
              </p>
            </div>
            {revNum > 0 && (
              <span className="text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-100">
                {((monthTotals.revenue / revNum) * 100).toFixed(1)}% da meta de receita
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <ProgressBar
              label="Receita"
              current={monthTotals.revenue}
              target={revNum}
              color="#5a8977"
              fmt={(v) => formatBRL(v)}
            />
            <ProgressBar
              label="Leads"
              current={monthTotals.leads}
              target={leadsNum}
              color="#8B5CF6"
              fmt={(v) => v.toLocaleString("pt-BR")}
            />
            <ProgressBar
              label="Vendas"
              current={monthTotals.sales}
              target={salesNum}
              color="#3B82F6"
              fmt={(v) => v.toLocaleString("pt-BR")}
            />
          </div>
        </div>
      )}
    </div>
  );
}
