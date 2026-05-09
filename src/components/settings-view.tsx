"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Check,
  X,
  Pencil,
  UserX,
  UserCheck,
  Trash2,
  Shield,
  Eye,
  Users,
  Building2,
  Webhook,
  BarChart3,
  Layers,
  AlertCircle,
  Loader2,
  RefreshCw,
  EyeOff,
} from "lucide-react";
import { settingsStorage } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import type { UserRole } from "@/lib/auth";
import {
  listUsers,
  createUser,
  updateUser,
  toggleUserActive,
  deleteUser,
  type ManagedUser,
} from "@/app/actions/users";

// ─── Role config ───────────────────────────────────────────────────────────────

const ROLES: Array<{
  value:       UserRole;
  label:       string;
  color:       string;
  bg:          string;
  border:      string;
  icon:        React.ElementType;
  description: string;
  perms:       string[];
}> = [
  {
    value:       "admin",
    label:       "Admin",
    color:       "text-purple-600",
    bg:          "bg-purple-50",
    border:      "border-purple-100",
    icon:        Shield,
    description: "Controle total da plataforma",
    perms: [
      "Acessa todas as áreas",
      "Cria, edita e exclui usuários",
      "Gerencia integrações e configurações",
    ],
  },
  {
    value:       "gestor",
    label:       "Gestor",
    color:       "text-blue-600",
    bg:          "bg-blue-50",
    border:      "border-blue-100",
    icon:        Eye,
    description: "Visão completa da operação",
    perms: [
      "Dashboard, Vendas, Metas e Insights",
      "Lança e edita todos os registros",
      "Sem acesso a Configurações",
    ],
  },
  {
    value:       "vendedor",
    label:       "Vendedor",
    color:       "text-green-600",
    bg:          "bg-green-50",
    border:      "border-green-100",
    icon:        Users,
    description: "Acesso aos próprios registros",
    perms: [
      "Apenas módulo Vendas",
      "Visualiza e lança seus próprios dados",
      "Sem acesso a dados do time",
    ],
  },
];

function roleConfig(role: UserRole) {
  return ROLES.find((r) => r.value === role) ?? ROLES[2];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function userInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

function formatLastSignIn(dateStr: string | null): string {
  if (!dateStr) return "Nunca";
  const d       = new Date(dateStr);
  const now     = new Date();
  const diffMs  = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 2)   return "Agora";
  if (diffMin < 60)  return `${diffMin}min atrás`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH   < 24)  return `${diffH}h atrás`;
  const diffD = Math.floor(diffH / 24);
  if (diffD   === 1) return "Ontem";
  if (diffD   < 30)  return `${diffD}d atrás`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// ─── Shared UI atoms ───────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100/80 overflow-hidden"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title:        string;
  description?: string;
  action?:      React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const r = roleConfig(role);
  return (
    <span
      className={cn(
        "inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border",
        r.bg, r.color, r.border,
      )}
    >
      {r.label}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border",
        active
          ? "bg-green-50 text-green-600 border-green-100"
          : "bg-gray-100 text-gray-400 border-gray-200",
      )}
    >
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

// ─── Team name field ───────────────────────────────────────────────────────────

function TeamNameField() {
  const [value, setValue]  = useState("");
  const [saved,  setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setValue(settingsStorage.get().teamName); }, []);

  function handleChange(v: string) {
    setValue(v);
    setSaved(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (v.trim().length > 0) {
        settingsStorage.save({ teamName: v.trim() });
        window.dispatchEvent(new Event("storage"));
        setSaved(true);
      }
    }, 600);
  }

  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
      <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
        <Building2 size={14} className="text-gray-400" strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          Nome do time
        </p>
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Sales Pro"
          maxLength={32}
          className="w-full text-sm font-medium text-gray-900 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 outline-none focus:border-green-200 focus:ring-2 focus:ring-green-100 transition-all"
        />
      </div>
      {saved && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100 flex-shrink-0">
          <Check size={9} strokeWidth={3} />
          Salvo
        </span>
      )}
    </div>
  );
}

// ─── User avatar ───────────────────────────────────────────────────────────────

const ROLE_AVATAR: Record<UserRole, string> = {
  admin:    "bg-purple-100 text-purple-700",
  gestor:   "bg-blue-100 text-blue-700",
  vendedor: "bg-green-100 text-green-700",
};

function UserAvatar({ name, role }: { name: string; role: UserRole }) {
  return (
    <div
      className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold",
        ROLE_AVATAR[role],
      )}
    >
      {userInitials(name)}
    </div>
  );
}

// ─── User row ──────────────────────────────────────────────────────────────────

function UserRow({
  managed,
  currentUserId,
  onEdit,
  onToggle,
  onDelete,
}: {
  managed:       ManagedUser;
  currentUserId: string;
  onEdit:        (u: ManagedUser) => void;
  onToggle:      (u: ManagedUser) => void;
  onDelete:      (u: ManagedUser) => void;
}) {
  const isSelf = managed.id === currentUserId;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50/40",
        !managed.active && "opacity-50",
      )}
    >
      <UserAvatar name={managed.name} role={managed.role} />

      {/* Name + email */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-900 truncate">{managed.name}</p>
          {isSelf && (
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
              Você
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 truncate">{managed.email}</p>
      </div>

      {/* Meta columns (hidden on very small screens) */}
      <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
        <RoleBadge role={managed.role} />
        <StatusBadge active={managed.active} />
        <p className="text-[11px] text-gray-400 w-14 text-right tabular-nums">
          {formatLastSignIn(managed.lastSignIn)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={() => onEdit(managed)}
          title="Editar"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Pencil size={12} strokeWidth={2} />
        </button>
        <button
          onClick={() => onToggle(managed)}
          title={managed.active ? "Desativar acesso" : "Ativar acesso"}
          disabled={isSelf}
          className={cn(
            "w-8 h-8 flex items-center justify-center rounded-lg transition-colors",
            isSelf
              ? "text-gray-200 cursor-not-allowed"
              : "text-gray-300 hover:text-gray-600 hover:bg-gray-50",
          )}
        >
          {managed.active
            ? <UserX      size={13} strokeWidth={1.8} />
            : <UserCheck  size={13} strokeWidth={1.8} />}
        </button>
        <button
          onClick={() => onDelete(managed)}
          title="Excluir usuário"
          disabled={isSelf}
          className={cn(
            "w-8 h-8 flex items-center justify-center rounded-lg transition-colors",
            isSelf
              ? "text-gray-200 cursor-not-allowed"
              : "text-gray-300 hover:text-red-500 hover:bg-red-50",
          )}
        >
          <Trash2 size={12} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}

// ─── User modal (create / edit) ────────────────────────────────────────────────

type ModalMode = "create" | "edit";

function UserModal({
  mode,
  target,
  isSelf = false,
  onSuccess,
  onClose,
}: {
  mode:      ModalMode;
  target?:   ManagedUser;
  isSelf?:   boolean;
  onSuccess: () => void;
  onClose:   () => void;
}) {
  const [name,       setName]       = useState(target?.name  ?? "");
  const [email,      setEmail]      = useState(target?.email ?? "");
  const [password,   setPassword]   = useState("");
  const [showPass,   setShowPass]   = useState(false);
  const [role,       setRole]       = useState<UserRole>(target?.role ?? "vendedor");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const result =
      mode === "create"
        ? await createUser({ name: name.trim(), email: email.trim(), password, role })
        : await updateUser({ id: target!.id, name: name.trim(), role });

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    } else {
      onSuccess();
    }
  }

  const inputClass =
    "w-full text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-green-300 focus:ring-2 focus:ring-green-100 focus:bg-white transition-all placeholder:text-gray-400";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.28)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl border border-gray-100 w-full max-w-[400px]"
        style={{ boxShadow: "0 8px 48px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.6)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-50">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">
              {mode === "create" ? "Novo usuário" : "Editar usuário"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {mode === "create"
                ? "Acesso imediato, sem confirmação de e-mail"
                : "Alterar nome e cargo do usuário"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Nome */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Nome
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
              required
              className={inputClass}
            />
          </div>

          {/* E-mail (apenas criação) */}
          {mode === "create" && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@eliorah.com"
                required
                className={inputClass}
              />
            </div>
          )}

          {/* Senha (apenas criação) */}
          {mode === "create" && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  className={cn(inputClass, "pr-11")}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPass
                    ? <EyeOff size={14} strokeWidth={1.8} />
                    : <Eye    size={14} strokeWidth={1.8} />}
                </button>
              </div>
            </div>
          )}

          {/* Cargo */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Cargo
            </label>
            {isSelf ? (
              <div className="mt-1 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-3">
                <AlertCircle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" strokeWidth={2} />
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Por segurança, você não pode alterar seu próprio cargo.
                  Peça a outro administrador se necessário.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border text-xs font-semibold transition-all",
                        role === r.value
                          ? cn(r.bg, r.color, r.border)
                          : "bg-white border-gray-100 text-gray-400 hover:border-gray-200 hover:text-gray-600",
                      )}
                    >
                      <r.icon size={14} strokeWidth={2} />
                      {r.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                  {roleConfig(role).description}
                </p>
              </>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <AlertCircle size={13} className="text-red-500 flex-shrink-0" strokeWidth={2} />
              <p className="text-[12px] text-red-600">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={cn(
                "flex-1 h-10 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all",
                submitting ? "opacity-60 cursor-not-allowed" : "hover:opacity-90",
              )}
              style={{ background: "#1a3228" }}
            >
              {submitting ? (
                <><Loader2 size={13} className="animate-spin" /> Salvando...</>
              ) : (
                mode === "create" ? "Criar usuário" : "Salvar alterações"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteConfirmModal({
  target,
  onConfirm,
  onClose,
}: {
  target:    ManagedUser;
  onConfirm: () => Promise<void>;
  onClose:   () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleDelete() {
    setLoading(true);
    const result = await onConfirm();
    if ((result as any)?.error) {
      setError((result as any).error);
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.28)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl border border-gray-100 w-full max-w-[360px] p-6"
        style={{ boxShadow: "0 8px 48px rgba(0,0,0,0.12)" }}
      >
        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-4">
          <Trash2 size={18} className="text-red-500" strokeWidth={1.8} />
        </div>
        <h2 className="text-[15px] font-bold text-gray-900 mb-1">Excluir usuário</h2>
        <p className="text-[13px] text-gray-500 leading-relaxed mb-5">
          <span className="font-semibold text-gray-700">{target.name}</span> perderá acesso
          imediatamente. Esta ação não pode ser desfeita.
        </p>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-4">
            <AlertCircle size={12} className="text-red-500 flex-shrink-0" strokeWidth={2} />
            <p className="text-[12px] text-red-600">{error}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className={cn(
              "flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all",
              loading ? "opacity-60 cursor-not-allowed" : "hover:bg-red-600",
            )}
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} strokeWidth={2} />}
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Users section ─────────────────────────────────────────────────────────────

function UsersSection({ currentUserId }: { currentUserId: string }) {
  const [users,   setUsers]   = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [modal,   setModal]   = useState<
    | { type: "create" }
    | { type: "edit";   target: ManagedUser }
    | { type: "delete"; target: ManagedUser }
    | null
  >(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await listUsers();
    if (result.error) setError(result.error);
    else setUsers(result.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(managed: ManagedUser) {
    await toggleUserActive(managed.id, !managed.active);
    load();
  }

  async function handleDelete(managed: ManagedUser): Promise<void> {
    const result = await deleteUser(managed.id);
    if (!result.error) {
      setModal(null);
      load();
    }
    return result as unknown as void;
  }

  const active   = users.filter((u) =>  u.active);
  const inactive = users.filter((u) => !u.active);

  return (
    <>
      <SectionHeader
        title="Usuários"
        description={
          loading
            ? "Carregando..."
            : `${active.length} ativo${active.length !== 1 ? "s" : ""} · ${users.length} total`
        }
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
              title="Recarregar"
            >
              <RefreshCw size={13} strokeWidth={2} className={cn(loading && "animate-spin")} />
            </button>
            <button
              onClick={() => setModal({ type: "create" })}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#1a3228] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              <Plus size={12} strokeWidth={2.5} />
              Novo usuário
            </button>
          </div>
        }
      />

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2.5 mx-5 my-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle size={13} className="text-red-500 flex-shrink-0" strokeWidth={2} />
          <p className="text-[12px] text-red-600">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !error && (
        <div className="divide-y divide-gray-50">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5">
              <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-100 rounded-full w-32 animate-pulse" />
                <div className="h-2.5 bg-gray-50 rounded-full w-48 animate-pulse" />
              </div>
              <div className="h-5 w-12 bg-gray-100 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Users list */}
      {!loading && !error && users.length > 0 && (
        <div>
          {active.length > 0 && (
            <>
              <div className="px-5 py-2 bg-gray-50/40">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Ativos
                </p>
              </div>
              <div className="divide-y divide-gray-50">
                {active.map((u) => (
                  <UserRow
                    key={u.id}
                    managed={u}
                    currentUserId={currentUserId}
                    onEdit={(m) => setModal({ type: "edit", target: m })}
                    onToggle={handleToggle}
                    onDelete={(m) => setModal({ type: "delete", target: m })}
                  />
                ))}
              </div>
            </>
          )}

          {inactive.length > 0 && (
            <>
              <div className="px-5 py-2 bg-gray-50/40 border-t border-gray-50">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Inativos
                </p>
              </div>
              <div className="divide-y divide-gray-50">
                {inactive.map((u) => (
                  <UserRow
                    key={u.id}
                    managed={u}
                    currentUserId={currentUserId}
                    onEdit={(m) => setModal({ type: "edit", target: m })}
                    onToggle={handleToggle}
                    onDelete={(m) => setModal({ type: "delete", target: m })}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && users.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
            <Users size={20} className="text-gray-300" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">Nenhum usuário cadastrado</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Crie o primeiro usuário da plataforma
            </p>
          </div>
          <button
            onClick={() => setModal({ type: "create" })}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ background: "#1a3228" }}
          >
            <Plus size={13} strokeWidth={2.5} />
            Criar usuário
          </button>
        </div>
      )}

      {/* Modals */}
      {modal?.type === "create" && (
        <UserModal
          mode="create"
          onSuccess={() => { setModal(null); load(); }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "edit" && (
        <UserModal
          mode="edit"
          target={modal.target}
          isSelf={modal.target.id === currentUserId}
          onSuccess={() => { setModal(null); load(); }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "delete" && (
        <DeleteConfirmModal
          target={modal.target}
          onConfirm={() => handleDelete(modal.target)}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

// ─── Permissions panel ─────────────────────────────────────────────────────────

function PermissionsPanel() {
  return (
    <div className="px-5 py-4 border-t border-gray-50">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Permissões por cargo
      </p>
      <div className="grid grid-cols-3 gap-2.5">
        {ROLES.map(({ value, label, color, bg, icon: Icon, perms }) => (
          <div key={value} className="rounded-xl border border-gray-100 p-3">
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center mb-2", bg)}>
              <Icon size={13} className={color} strokeWidth={2} />
            </div>
            <p className={cn("text-xs font-bold mb-2", color)}>{label}</p>
            <ul className="space-y-1">
              {perms.map((p) => (
                <li key={p} className="text-[10px] text-gray-400 leading-relaxed flex items-start gap-1">
                  <span className="text-gray-300 mt-0.5 flex-shrink-0">·</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Integrations ──────────────────────────────────────────────────────────────

type IntegrationStatus = "em_breve" | "conectado" | "disponivel";

interface Integration {
  id:          string;
  name:        string;
  description: string;
  icon:        React.ElementType;
  iconBg:      string;
  iconColor:   string;
  status:      IntegrationStatus;
}

const INTEGRATIONS: Integration[] = [
  {
    id:          "meta",
    name:        "Meta Ads",
    description: "Importe investimento e leads do gerenciador de anúncios",
    icon:        BarChart3,
    iconBg:      "bg-blue-50",
    iconColor:   "text-blue-600",
    status:      "em_breve",
  },
  {
    id:          "webhooks",
    name:        "Webhooks",
    description: "Envie eventos para sistemas externos via HTTP",
    icon:        Webhook,
    iconBg:      "bg-gray-100",
    iconColor:   "text-gray-500",
    status:      "disponivel",
  },
  {
    id:          "kommo",
    name:        "Kommo CRM",
    description: "Sincronize leads e negociações com o funil de vendas",
    icon:        Layers,
    iconBg:      "bg-violet-50",
    iconColor:   "text-violet-600",
    status:      "em_breve",
  },
];

const STATUS_CONFIG: Record<IntegrationStatus, { label: string; className: string }> = {
  em_breve:   { label: "Em breve",   className: "text-amber-600 bg-amber-50 border-amber-100" },
  conectado:  { label: "Conectado",  className: "text-green-600 bg-green-50 border-green-100" },
  disponivel: { label: "Disponível", className: "text-blue-600 bg-blue-50 border-blue-100"   },
};

function IntegrationCard({ integration }: { integration: Integration }) {
  const status = STATUS_CONFIG[integration.status];
  const Icon   = integration.icon;
  return (
    <div className="flex items-start gap-3.5 p-4 rounded-xl border border-gray-100 hover:border-gray-200 bg-white hover:bg-gray-50/30 transition-colors">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", integration.iconBg)}>
        <Icon size={18} className={integration.iconColor} strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-semibold text-gray-900 leading-tight">{integration.name}</p>
          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0", status.className)}>
            {status.label}
          </span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">{integration.description}</p>
      </div>
    </div>
  );
}

// ─── Main view ─────────────────────────────────────────────────────────────────

export function SettingsView() {
  const { user } = useAuth();
  const isAdmin  = user?.role === "admin";

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors mb-3"
        >
          <ArrowLeft size={13} strokeWidth={2.5} />
          Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Configurações</h1>
        <p className="text-sm text-gray-400 mt-0.5">Equipe e integrações da plataforma</p>
      </div>

      <div className="space-y-6">

        {/* ── Equipe ─────────────────────────────────────────────────────────── */}
        <SectionCard>
          <TeamNameField />

          {isAdmin ? (
            <>
              <UsersSection currentUserId={user?.id ?? ""} />
              <PermissionsPanel />
            </>
          ) : (
            <div className="px-5 py-6 text-center">
              <p className="text-sm text-gray-400">
                Apenas administradores podem gerenciar usuários.
              </p>
            </div>
          )}
        </SectionCard>

        {/* ── Integrações ────────────────────────────────────────────────────── */}
        <SectionCard>
          <SectionHeader
            title="Integrações"
            description="Conecte ferramentas externas à plataforma"
          />
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INTEGRATIONS.map((integration) => (
                <IntegrationCard key={integration.id} integration={integration} />
              ))}
            </div>
          </div>
        </SectionCard>

      </div>
    </div>
  );
}
