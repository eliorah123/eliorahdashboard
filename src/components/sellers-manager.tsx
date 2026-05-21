"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Check,
  X,
  UserCheck,
  UserX,
  Users,
  Trash2,
} from "lucide-react";
import { sellerRepository, entryRepository, type Seller } from "@/lib/storage";
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
import { cn } from "@/lib/utils";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatBRL(v: number): string {
  if (v === 0) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

function currentMonthRange(): { from: string; to: string } {
  const now  = new Date();
  const y    = now.getFullYear();
  const m    = String(now.getMonth() + 1).padStart(2, "0");
  const d    = String(now.getDate()).padStart(2, "0");
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${d}` };
}

// ─── Inline name editor ────────────────────────────────────────────────────────

interface NameEditorProps {
  initial: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}

function NameEditor({ initial, onSave, onCancel }: NameEditorProps) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  function commit() {
    const trimmed = value.trim();
    if (trimmed.length > 0) onSave(trimmed);
  }

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter")  { e.preventDefault(); commit(); }
          if (e.key === "Escape") onCancel();
        }}
        className="flex-1 min-w-0 text-sm font-medium text-gray-900 bg-gray-50 border border-green-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-200"
      />
      <button
        onClick={commit}
        className="w-7 h-7 flex items-center justify-center rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors flex-shrink-0"
      >
        <Check size={13} strokeWidth={2.5} />
      </button>
      <button
        onClick={onCancel}
        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors flex-shrink-0"
      >
        <X size={13} strokeWidth={2.5} />
      </button>
    </div>
  );
}

// ─── Seller row ────────────────────────────────────────────────────────────────

interface SellerRowProps {
  seller:   Seller;
  stats:    { sales: number; revenue: number } | undefined;
  onRename: (id: string, name: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}

function SellerRow({ seller, stats, onRename, onToggle, onRemove }: SellerRowProps) {
  const [editing, setEditing] = useState(false);

  const initials = seller.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-5 py-3.5 transition-colors",
        !seller.active && "opacity-50",
      )}
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-gray-500">{initials}</span>
      </div>

      {/* Name / editor */}
      {editing ? (
        <NameEditor
          initial={seller.name}
          onSave={(name) => { onRename(seller.id, name); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-800 truncate">{seller.name}</p>
            {!seller.active && (
              <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                inativo
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">
            {stats && stats.sales > 0
              ? `${stats.sales} venda${stats.sales !== 1 ? "s" : ""} este mês`
              : "sem vendas este mês"}
          </p>
        </div>
      )}

      {/* Stats */}
      {!editing && (
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold text-gray-900">
            {stats ? formatBRL(stats.revenue) : "—"}
          </p>
        </div>
      )}

      {/* Actions */}
      {!editing && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setEditing(true)}
            title="Renomear"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Pencil size={13} strokeWidth={2} />
          </button>
          <button
            onClick={() => onToggle(seller.id)}
            title={seller.active ? "Desativar" : "Ativar"}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {seller.active
              ? <UserX size={14} strokeWidth={1.8} />
              : <UserCheck size={14} strokeWidth={1.8} />}
          </button>
          <button
            onClick={() => onRemove(seller.id)}
            title="Remover"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} strokeWidth={1.8} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Add seller form ───────────────────────────────────────────────────────────

interface AddFormProps {
  onAdd: (name: string) => void;
  onCancel: () => void;
}

function AddForm({ onAdd, onCancel }: AddFormProps) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  function commit() {
    const trimmed = value.trim();
    if (trimmed.length > 0) onAdd(trimmed);
  }

  return (
    <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-50">
      <div className="w-9 h-9 rounded-full bg-green-50 border-2 border-dashed border-green-200 flex items-center justify-center flex-shrink-0">
        <Plus size={14} className="text-green-400" strokeWidth={2.5} />
      </div>
      <input
        ref={ref}
        type="text"
        placeholder="Nome do vendedor"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter")  { e.preventDefault(); commit(); }
          if (e.key === "Escape") onCancel();
        }}
        className="flex-1 min-w-0 text-sm font-medium text-gray-900 bg-gray-50 border border-green-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-200"
      />
      <button
        onClick={commit}
        disabled={value.trim().length === 0}
        className={cn(
          "flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors",
          value.trim().length > 0
            ? "bg-green-500 text-white hover:bg-green-600"
            : "bg-gray-100 text-gray-400 cursor-not-allowed",
        )}
      >
        <Check size={12} strokeWidth={2.5} />
        Adicionar
      </button>
      <button
        onClick={onCancel}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-4">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
        <Users size={24} className="text-gray-300" strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-700">Nenhum vendedor cadastrado</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">
          Adicione sua equipe para acompanhar o ranking individual no dashboard.
        </p>
      </div>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors shadow-[0_4px_14px_rgba(90,137,119,0.25)]"
      >
        <Plus size={14} strokeWidth={2.5} />
        Adicionar vendedor
      </button>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function SellersManager() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [monthStats, setMonthStats] = useState<Map<string, { sales: number; revenue: number }>>(new Map());
  const [adding, setAdding] = useState(false);

  function reload() {
    setSellers(sellerRepository.list());
    const { from, to } = currentMonthRange();
    setMonthStats(sumBySeller(entryRepository.list(), from, to));
  }

  useEffect(() => {
    reload();
    window.addEventListener("storage", reload);
    return () => window.removeEventListener("storage", reload);
  }, []);

  function handleAdd(name: string) {
    sellerRepository.add(name);
    setAdding(false);
    reload();
    window.dispatchEvent(new Event("storage"));
  }

  function handleRename(id: string, name: string) {
    sellerRepository.rename(id, name);
    reload();
    window.dispatchEvent(new Event("storage"));
  }

  function handleToggle(id: string) {
    sellerRepository.toggleActive(id);
    reload();
    window.dispatchEvent(new Event("storage"));
  }

  function handleRemove(id: string) {
    sellerRepository.remove(id);
    reload();
    window.dispatchEvent(new Event("storage"));
  }

  const active   = sellers.filter((s) => s.active);
  const inactive = sellers.filter((s) => !s.active);

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
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Vendedores</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Gerencie sua equipe de vendas
          </p>
        </div>

        {sellers.length > 0 && (
          <button
            onClick={() => setAdding(true)}
            className="mt-8 inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors shadow-[0_4px_14px_rgba(90,137,119,0.25)] flex-shrink-0"
          >
            <Plus size={14} strokeWidth={2.5} />
            Novo
          </button>
        )}
      </div>

      {/* List card */}
      <div
        className="bg-white rounded-2xl border border-gray-100/80 overflow-hidden"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)" }}
      >
        {sellers.length === 0 && !adding ? (
          <EmptyState onAdd={() => setAdding(true)} />
        ) : (
          <>
            {/* Header row */}
            {sellers.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                  Equipe · {active.length} ativo{active.length !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-gray-400">Receita este mês</p>
              </div>
            )}

            {/* Active sellers */}
            <div className="divide-y divide-gray-50">
              {active.map((s) => (
                <SellerRow
                  key={s.id}
                  seller={s}
                  stats={monthStats.get(s.id)}
                  onRename={handleRename}
                  onToggle={handleToggle}
                  onRemove={handleRemove}
                />
              ))}
            </div>

            {/* Inactive sellers */}
            {inactive.length > 0 && (
              <>
                <div className="px-5 py-2 bg-gray-50/60 border-y border-gray-100">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                    Inativos
                  </p>
                </div>
                <div className="divide-y divide-gray-50">
                  {inactive.map((s) => (
                    <SellerRow
                      key={s.id}
                      seller={s}
                      stats={monthStats.get(s.id)}
                      onRename={handleRename}
                      onToggle={handleToggle}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Add form */}
            {adding && (
              <AddForm
                onAdd={handleAdd}
                onCancel={() => setAdding(false)}
              />
            )}

            {/* Add button (when list exists and not adding) */}
            {!adding && sellers.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-50">
                <button
                  onClick={() => setAdding(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <Plus size={13} strokeWidth={2.5} />
                  Adicionar vendedor
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Info callout */}
      {sellers.length > 0 && (
        <p className="text-xs text-gray-400 mt-4 text-center">
          Distribua as vendas por vendedor ao preencher o{" "}
          <Link href="/input" className="text-green-600 hover:underline font-medium">
            Input Diário
          </Link>
          .
        </p>
      )}
    </div>
  );
}
