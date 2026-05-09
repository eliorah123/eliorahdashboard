"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Users,
  ShoppingCart,
  TrendingUp,
  FileText,
  Pencil,
  RefreshCw,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  computeMetrics,
  parseCurrency,
  parseInteger,
  type DailyEntry,
} from "@/types/daily-entry";
import {
  entryRepository,
  sellerRepository,
  sellerStatsRepository,
  type Seller,
} from "@/lib/storage";

// ─── helpers ──────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatBRL(val: number): string {
  if (!isFinite(val) || val === 0) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(val);
}

function formatBRLShort(val: number): string {
  if (!isFinite(val) || val === 0) return "—";
  if (val >= 1000) {
    return `R$ ${(val / 1000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(val);
}

// ─── sub-components ───────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  icon: React.ReactNode;
  prefix?: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (v: string) => void;
  onEnterPress: () => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
  autoFocus?: boolean;
}

function InputField({
  label,
  icon,
  prefix,
  inputRef,
  value,
  onChange,
  onEnterPress,
  inputMode = "decimal",
  placeholder = "0",
  autoFocus = false,
}: FieldProps) {
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
          ref={inputRef}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            const raw = e.target.value;
            if (inputMode === "numeric") {
              onChange(raw.replace(/\D/g, ""));
            } else {
              onChange(raw.replace(/[^0-9,.]/g, ""));
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnterPress();
            }
          }}
          className="flex-1 min-w-0 bg-transparent text-xl font-semibold text-gray-900 outline-none placeholder:text-gray-300"
        />
      </div>
    </div>
  );
}

interface MetricPillProps {
  label: string;
  value: string;
  highlight?: "positive" | "negative" | "neutral";
}

function MetricPill({ label, value, highlight = "neutral" }: MetricPillProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[72px] bg-gray-50 rounded-xl px-3 py-2.5">
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-bold",
          highlight === "positive" && "text-green-600",
          highlight === "negative" && "text-red-500",
          highlight === "neutral" && "text-gray-700",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── success view ─────────────────────────────────────────────────────────────

interface SuccessViewProps {
  entry: DailyEntry;
  onNewEntry: () => void;
}

function SuccessView({ entry, onNewEntry }: SuccessViewProps) {
  const m = computeMetrics(
    entry.investment,
    entry.leads,
    entry.sales,
    entry.revenue,
  );

  return (
    <div className="animate-in fade-in duration-300 flex flex-col items-center gap-6 py-10 px-4">
      <div className="w-16 h-16 rounded-full bg-green-50 border border-green-100 flex items-center justify-center">
        <Check size={28} className="text-green-500" strokeWidth={2.5} />
      </div>

      <div className="text-center">
        <p className="text-xl font-bold text-gray-900">Registro salvo!</p>
        <p className="text-sm text-gray-400 mt-1 capitalize">
          {formatDate(entry.date)}
        </p>
      </div>

      {/* Summary grid */}
      <div className="w-full max-w-sm grid grid-cols-2 gap-3">
        {[
          { label: "Investimento", value: formatBRL(entry.investment) },
          { label: "Faturamento", value: formatBRL(entry.revenue) },
          { label: "Leads", value: entry.leads.toLocaleString("pt-BR") },
          { label: "Vendas", value: entry.sales.toLocaleString("pt-BR") },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col gap-0.5 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100"
          >
            <span className="text-xs text-gray-400">{label}</span>
            <span className="text-base font-bold text-gray-900">{value}</span>
          </div>
        ))}
      </div>

      {/* Derived metrics */}
      <div className="w-full max-w-sm flex gap-2">
        <MetricPill
          label="ROAS"
          value={isFinite(m.roas) && m.roas > 0 ? `${m.roas.toFixed(2)}x` : "—"}
          highlight={m.roas >= 3 ? "positive" : m.roas > 0 ? "neutral" : "neutral"}
        />
        <MetricPill
          label="CPL"
          value={formatBRLShort(m.cpl)}
          highlight="neutral"
        />
        <MetricPill
          label="Conversão"
          value={
            m.conversionRate > 0 ? `${m.conversionRate.toFixed(1)}%` : "—"
          }
          highlight="neutral"
        />
        <MetricPill
          label="Lucro"
          value={formatBRLShort(m.profit)}
          highlight={m.profit > 0 ? "positive" : m.profit < 0 ? "negative" : "neutral"}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 w-full max-w-sm mt-2">
        <button
          onClick={onNewEntry}
          className="flex items-center justify-center gap-2 flex-1 h-11 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all"
        >
          <RefreshCw size={14} strokeWidth={2.5} />
          Novo registro
        </button>
        <Link
          href="/"
          className="flex items-center justify-center gap-2 flex-1 h-11 rounded-xl bg-gray-900 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
        >
          <LayoutDashboard size={14} strokeWidth={2.5} />
          Dashboard
        </Link>
      </div>
    </div>
  );
}

// ─── recent entries ───────────────────────────────────────────────────────────

interface RecentEntriesProps {
  entries: DailyEntry[];
  currentDate: string;
  onSelect: (entry: DailyEntry) => void;
}

function RecentEntries({ entries, currentDate, onSelect }: RecentEntriesProps) {
  if (entries.length === 0) return null;

  return (
    <div className="mt-8">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
        Registros recentes
      </p>
      <div
        className="bg-white rounded-2xl border border-gray-100/80 overflow-hidden"
        style={{
          boxShadow:
            "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
        }}
      >
        {entries.map((entry, i) => {
          const isActive = entry.date === currentDate;
          return (
            <button
              key={entry.id}
              onClick={() => onSelect(entry)}
              className={cn(
                "w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors",
                i > 0 && "border-t border-gray-50",
                isActive
                  ? "bg-green-50/60"
                  : "hover:bg-gray-50/60",
              )}
            >
              <div className="flex-shrink-0 text-left">
                <p className="text-xs font-semibold text-gray-500 capitalize">
                  {new Date(entry.date + "T12:00:00").toLocaleDateString(
                    "pt-BR",
                    { weekday: "short", day: "numeric", month: "short" },
                  )}
                </p>
                {isActive && (
                  <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 rounded-full">
                    Hoje
                  </span>
                )}
              </div>

              <div className="flex-1 grid grid-cols-4 gap-2 text-right">
                {[
                  {
                    label: "Invest.",
                    value: formatBRLShort(entry.investment),
                  },
                  {
                    label: "Faturamento",
                    value: formatBRLShort(entry.revenue),
                  },
                  { label: "Leads", value: entry.leads.toLocaleString("pt-BR") },
                  {
                    label: "Vendas",
                    value: entry.sales.toLocaleString("pt-BR"),
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-gray-400">{label}</span>
                    <span className="text-xs font-semibold text-gray-800">
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <Pencil
                size={13}
                className="flex-shrink-0 text-gray-300"
                strokeWidth={2}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── seller distribution ──────────────────────────────────────────────────────

interface SellerDistributionProps {
  date: string;
}

function SellerDistribution({ date }: SellerDistributionProps) {
  const [sellers, setSellers]           = useState<Seller[]>([]);
  const [expanded, setExpanded]         = useState(false);
  const [sellerSales, setSellerSales]   = useState<Record<string, string>>({});
  const [sellerRevenue, setSellerRevenue] = useState<Record<string, string>>({});
  const [saved, setSaved]               = useState(false);

  useEffect(() => {
    setSellers(sellerRepository.listActive());
  }, []);

  useEffect(() => {
    const stats = sellerStatsRepository.getDay(date);
    const s: Record<string, string> = {};
    const r: Record<string, string> = {};
    for (const st of stats) {
      s[st.sellerId] = st.sales   > 0 ? String(st.sales)   : "";
      r[st.sellerId] = st.revenue > 0 ? String(st.revenue) : "";
    }
    setSellerSales(s);
    setSellerRevenue(r);
    setSaved(false);
  }, [date]);

  function handleSave() {
    sellerStatsRepository.saveDay(
      date,
      sellers.map((s) => ({
        sellerId: s.id,
        sales:    parseInteger(sellerSales[s.id]   ?? ""),
        revenue:  parseCurrency(sellerRevenue[s.id] ?? ""),
      })),
    );
    setSaved(true);
    window.dispatchEvent(new Event("storage"));
  }

  if (sellers.length === 0) return null;

  const hasAnyValue = sellers.some(
    (s) => sellerSales[s.id] || sellerRevenue[s.id],
  );

  return (
    <div
      className="mt-4 bg-white rounded-2xl border border-gray-100/80 overflow-hidden"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
    >
      {/* Toggle header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users size={14} strokeWidth={2} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Por vendedor</span>
          <span className="text-xs text-gray-400 font-normal">opcional</span>
          {hasAnyValue && !expanded && (
            <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100">
              preenchido
            </span>
          )}
          {saved && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100">
              <Check size={9} strokeWidth={3} />
              salvo
            </span>
          )}
        </div>
        {expanded
          ? <ChevronUp   size={15} className="text-gray-400" strokeWidth={2} />
          : <ChevronDown size={15} className="text-gray-400" strokeWidth={2} />}
      </button>

      {/* Expanded rows */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-50">
          <p className="text-xs text-gray-400 mt-4 mb-4">
            Distribua as vendas e o faturamento entre os vendedores do time.
          </p>

          <div className="space-y-3">
            {sellers.map((seller) => {
              const initials = seller.name
                .split(" ").slice(0, 2)
                .map((w) => w[0]).join("").toUpperCase();
              return (
                <div key={seller.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-gray-500">{initials}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-28 truncate flex-shrink-0">
                    {seller.name}
                  </span>
                  <div className="flex gap-2 flex-1">
                    {/* Sales */}
                    <div
                      className={cn(
                        "flex items-center gap-1.5 flex-1 h-10 px-3 rounded-xl border-2 transition-all",
                        "bg-gray-50/80 border-transparent",
                        "focus-within:bg-white focus-within:border-green-200",
                        sellerSales[seller.id] && "border-gray-100 bg-white",
                      )}
                    >
                      <ShoppingCart size={11} className="text-gray-300 flex-shrink-0" strokeWidth={2} />
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0 vendas"
                        value={sellerSales[seller.id] ?? ""}
                        onChange={(e) => {
                          setSaved(false);
                          setSellerSales((prev) => ({
                            ...prev,
                            [seller.id]: e.target.value.replace(/\D/g, ""),
                          }));
                        }}
                        className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-gray-900 outline-none placeholder:text-gray-300"
                      />
                    </div>
                    {/* Revenue */}
                    <div
                      className={cn(
                        "flex items-center gap-1.5 flex-1 h-10 px-3 rounded-xl border-2 transition-all",
                        "bg-gray-50/80 border-transparent",
                        "focus-within:bg-white focus-within:border-green-200",
                        sellerRevenue[seller.id] && "border-gray-100 bg-white",
                      )}
                    >
                      <span className="text-gray-300 text-xs font-semibold flex-shrink-0">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={sellerRevenue[seller.id] ?? ""}
                        onChange={(e) => {
                          setSaved(false);
                          setSellerRevenue((prev) => ({
                            ...prev,
                            [seller.id]: e.target.value.replace(/[^0-9,.]/g, ""),
                          }));
                        }}
                        className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-gray-900 outline-none placeholder:text-gray-300"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleSave}
            className="mt-5 w-full h-11 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 active:scale-[0.99] transition-all"
          >
            Salvar distribuição
          </button>
        </div>
      )}
    </div>
  );
}

// ─── main form ────────────────────────────────────────────────────────────────

export function DailyInputForm() {
  const today = todayISO();

  const [date, setDate] = useState(today);
  const [investment, setInvestment] = useState("");
  const [leads, setLeads] = useState("");
  const [sales, setSales] = useState("");
  const [revenue, setRevenue] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "saved">("idle");
  const [savedEntry, setSavedEntry] = useState<DailyEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [recentEntries, setRecentEntries] = useState<DailyEntry[]>([]);

  const investmentRef = useRef<HTMLInputElement>(null);
  const leadsRef = useRef<HTMLInputElement>(null);
  const salesRef = useRef<HTMLInputElement>(null);
  const revenueRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  // Populate form if an entry already exists for the selected date
  useEffect(() => {
    const existing = entryRepository.findByDate(date);
    if (existing) {
      setInvestment(existing.investment > 0 ? String(existing.investment) : "");
      setLeads(existing.leads > 0 ? String(existing.leads) : "");
      setSales(existing.sales > 0 ? String(existing.sales) : "");
      setRevenue(existing.revenue > 0 ? String(existing.revenue) : "");
      setNotes(existing.notes ?? "");
      setIsEditing(true);
    } else {
      setInvestment("");
      setLeads("");
      setSales("");
      setRevenue("");
      setNotes("");
      setIsEditing(false);
    }
    setStatus("idle");
    setSavedEntry(null);
    setRecentEntries(entryRepository.list().slice(0, 6));
  }, [date]);

  // Real-time metrics
  const metrics = useMemo(() => {
    const inv = parseCurrency(investment);
    const l = parseInteger(leads);
    const s = parseInteger(sales);
    const rev = parseCurrency(revenue);
    return computeMetrics(inv, l, s, rev);
  }, [investment, leads, sales, revenue]);

  const isValid =
    investment.trim() !== "" &&
    leads.trim() !== "" &&
    sales.trim() !== "" &&
    revenue.trim() !== "";

  const hasAnyValue =
    investment !== "" || leads !== "" || sales !== "" || revenue !== "";

  function handleSave() {
    if (!isValid) return;
    const entry = entryRepository.upsert({
      date,
      investment: parseCurrency(investment),
      leads: parseInteger(leads),
      sales: parseInteger(sales),
      revenue: parseCurrency(revenue),
      notes: notes.trim(),
    });
    setSavedEntry(entry);
    setStatus("saved");
    setRecentEntries(entryRepository.list().slice(0, 6));
  }

  function handleReset() {
    setDate(today);
    setStatus("idle");
    setSavedEntry(null);
    setTimeout(() => investmentRef.current?.focus(), 50);
  }

  function handleSelectEntry(entry: DailyEntry) {
    setDate(entry.date);
    setStatus("idle");
  }

  if (status === "saved" && savedEntry) {
    return <SuccessView entry={savedEntry} onNewEntry={handleReset} />;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors mb-3"
          >
            <ArrowLeft size={13} strokeWidth={2.5} />
            Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Input Diário
          </h1>
          <p className="text-sm text-gray-400 mt-0.5 capitalize">
            {formatDate(date)}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 mt-8">
          {isEditing && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
              <Pencil size={10} strokeWidth={2.5} />
              Editando
            </span>
          )}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-xs font-medium text-gray-600 bg-gray-100 border-0 rounded-xl px-3 py-2 outline-none cursor-pointer hover:bg-gray-150 focus:ring-2 focus:ring-green-200 transition-all"
          />
        </div>
      </div>

      {/* Form card */}
      <div
        className="bg-white rounded-2xl border border-gray-100/80 p-6"
        style={{
          boxShadow:
            "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
        }}
      >
        {/* Monetary fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <InputField
            label="Investimento"
            icon={<DollarSign size={12} strokeWidth={2.5} />}
            prefix="R$"
            inputRef={investmentRef}
            value={investment}
            onChange={setInvestment}
            onEnterPress={() => leadsRef.current?.focus()}
            autoFocus
          />
          <InputField
            label="Faturamento"
            icon={<TrendingUp size={12} strokeWidth={2.5} />}
            prefix="R$"
            inputRef={revenueRef}
            value={revenue}
            onChange={setRevenue}
            onEnterPress={() => notesRef.current?.focus()}
          />
        </div>

        {/* Integer fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <InputField
            label="Leads"
            icon={<Users size={12} strokeWidth={2.5} />}
            inputRef={leadsRef}
            value={leads}
            onChange={setLeads}
            onEnterPress={() => salesRef.current?.focus()}
            inputMode="numeric"
            placeholder="0"
          />
          <InputField
            label="Vendas"
            icon={<ShoppingCart size={12} strokeWidth={2.5} />}
            inputRef={salesRef}
            value={sales}
            onChange={setSales}
            onEnterPress={() => revenueRef.current?.focus()}
            inputMode="numeric"
            placeholder="0"
          />
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5 mb-6">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-widest">
            <FileText size={12} strokeWidth={2.5} className="opacity-60" />
            Observações
            <span className="text-[10px] normal-case font-normal text-gray-300 ml-1">
              opcional
            </span>
          </label>
          <textarea
            ref={notesRef}
            rows={2}
            placeholder="Anotações do dia, campanhas, ocorrências..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.metaKey) {
                e.preventDefault();
                submitRef.current?.focus();
              }
            }}
            className={cn(
              "w-full resize-none rounded-xl px-4 py-3 text-sm text-gray-900 border-2 transition-all duration-150 outline-none",
              "bg-gray-50/80 border-transparent placeholder:text-gray-300",
              "focus:bg-white focus:border-green-200 focus:shadow-[0_0_0_4px_rgba(90,137,119,0.07)]",
              notes && "border-gray-100 bg-white",
            )}
          />
        </div>

        {/* Real-time metrics */}
        <div
          className={cn(
            "flex gap-2 mb-6 transition-opacity duration-300",
            hasAnyValue ? "opacity-100" : "opacity-30",
          )}
        >
          <MetricPill
            label="CPL"
            value={
              metrics.cpl > 0 ? formatBRLShort(metrics.cpl) : "—"
            }
            highlight="neutral"
          />
          <MetricPill
            label="Conversão"
            value={
              metrics.conversionRate > 0
                ? `${metrics.conversionRate.toFixed(1)}%`
                : "—"
            }
            highlight="neutral"
          />
          <MetricPill
            label="ROAS"
            value={
              metrics.roas > 0 ? `${metrics.roas.toFixed(2)}x` : "—"
            }
            highlight={
              metrics.roas >= 3
                ? "positive"
                : metrics.roas > 0
                  ? "neutral"
                  : "neutral"
            }
          />
          <MetricPill
            label="Ticket"
            value={
              metrics.avgTicket > 0 ? formatBRLShort(metrics.avgTicket) : "—"
            }
            highlight="neutral"
          />
          <MetricPill
            label="Lucro"
            value={
              parseCurrency(investment) > 0 || parseCurrency(revenue) > 0
                ? formatBRLShort(metrics.profit)
                : "—"
            }
            highlight={
              metrics.profit > 0
                ? "positive"
                : metrics.profit < 0
                  ? "negative"
                  : "neutral"
            }
          />
        </div>

        {/* Submit */}
        <button
          ref={submitRef}
          onClick={handleSave}
          disabled={!isValid}
          className={cn(
            "w-full h-14 rounded-xl text-base font-semibold transition-all duration-150",
            isValid
              ? "bg-green-500 text-white hover:bg-green-600 active:scale-[0.99] shadow-[0_4px_14px_rgba(90,137,119,0.3)]"
              : "bg-gray-100 text-gray-400 cursor-not-allowed",
          )}
        >
          {isEditing ? "Atualizar Registro" : "Salvar Registro"}
        </button>

        {!isValid && hasAnyValue && (
          <p className="text-xs text-center text-gray-400 mt-3">
            Preencha todos os campos obrigatórios para salvar.
          </p>
        )}
      </div>

      {/* Seller distribution */}
      <SellerDistribution date={date} />

      {/* Recent entries */}
      <RecentEntries
        entries={recentEntries}
        currentDate={date}
        onSelect={handleSelectEntry}
      />
    </div>
  );
}
