"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Unlink,
  Shield,
  Zap,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getMetaConnectionStatus,
  selectAdAccounts,
} from "@/app/actions/integrations";
import type { MetaConnectionInfo } from "@/types/integrations";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return "Nunca sincronizado";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return "Agora mesmo";
  if (diff < 3600)  return `Há ${Math.round(diff / 60)} min`;
  if (diff < 86400) return `Há ${Math.round(diff / 3600)}h`;
  return `Há ${Math.round(diff / 86400)} dias`;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CFG = {
  connected:     { label: "Conectado",      cls: "bg-green-50 text-green-700", dot: "bg-green-500"             },
  syncing:       { label: "Sincronizando",  cls: "bg-blue-50 text-blue-700",   dot: "bg-blue-500 animate-pulse" },
  error:         { label: "Erro",           cls: "bg-red-50 text-red-600",     dot: "bg-red-500"               },
  token_expired: { label: "Token expirado", cls: "bg-amber-50 text-amber-700", dot: "bg-amber-500"             },
  not_connected: { label: "Não conectado",  cls: "bg-gray-100 text-gray-500",  dot: "bg-gray-300"              },
} as const;

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.not_connected;
  return (
    <span className={cn("inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-xs font-semibold", cfg.cls)}>
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, type }: { msg: string; type: "ok" | "err" }) {
  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg border animate-in fade-in slide-in-from-bottom-2 duration-200",
        type === "ok"
          ? "bg-green-50 text-green-800 border-green-200"
          : "bg-red-50 text-red-800 border-red-200",
      )}
    >
      {type === "ok"
        ? <CheckCircle2 size={15} />
        : <XCircle size={15} />}
      {msg}
    </div>
  );
}

// ─── Account selector ─────────────────────────────────────────────────────────

function AccountSelector({
  connection,
  onSave,
  saving,
}: {
  connection: MetaConnectionInfo;
  onSave: (ids: string[]) => void;
  saving: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(
    connection.adAccounts.filter(a => a.isSelected).map(a => a.accountId),
  );

  function toggle(id: string) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
        Contas de anúncios
      </p>
      <p className="text-xs text-gray-500">
        Selecione quais contas deseja sincronizar:
      </p>
      {connection.adAccounts.map(a => (
        <label key={a.accountId} className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.includes(a.accountId)}
            onChange={() => toggle(a.accountId)}
            className="w-4 h-4 rounded border-gray-300 accent-green-600"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{a.accountName}</p>
            <p className="text-xs text-gray-400">{a.currency} · {a.accountId}</p>
          </div>
        </label>
      ))}
      <button
        onClick={() => onSave(selected)}
        disabled={saving || selected.length === 0}
        className="w-full h-9 rounded-xl bg-green-500 text-white text-sm font-semibold disabled:opacity-50 hover:bg-green-600 transition-colors"
      >
        {saving ? "Salvando…" : `Confirmar ${selected.length > 0 ? `(${selected.length})` : ""}`}
      </button>
    </div>
  );
}

// ─── Disconnect confirm ───────────────────────────────────────────────────────

function DisconnectConfirm({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-100 space-y-3">
      <p className="text-sm font-semibold text-red-800">Desconectar Meta Ads?</p>
      <p className="text-xs text-red-700 leading-relaxed">
        A sincronização automática será pausada. Os dados já sincronizados serão mantidos.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="h-8 px-4 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors"
        >
          Desconectar
        </button>
        <button
          onClick={onCancel}
          className="h-8 px-4 rounded-lg bg-white text-gray-600 text-xs font-semibold border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Meta Ads card ────────────────────────────────────────────────────────────

function MetaAdsCard({
  connection,
  loading,
  syncing,
  savingAccounts,
  onSync,
  onDisconnect,
  onSelectAccounts,
}: {
  connection:     MetaConnectionInfo | null;
  loading:        boolean;
  syncing:        boolean;
  savingAccounts: boolean;
  onSync:          () => void;
  onDisconnect:    () => void;
  onSelectAccounts:(ids: string[]) => void;
}) {
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const isConnected     = connection?.status === "connected" || connection?.status === "syncing";
  const needsReconnect  = connection?.status === "error" || connection?.status === "token_expired";
  const selectedCount   = connection?.adAccounts.filter(a => a.isSelected).length ?? 0;
  const showAccountSel  = isConnected && connection!.adAccounts.length > 0 && selectedCount === 0;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100/80 p-6 flex flex-col gap-5"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
            style={{ background: "#1877F2" }}
          >
            M
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Meta Ads</p>
            <p className="text-xs text-gray-400">Facebook · Instagram · Audience Network</p>
          </div>
        </div>
        <StatusBadge status={loading ? "not_connected" : (connection?.status ?? "not_connected")} />
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-gray-100 rounded w-3/4" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
      )}

      {/* ── Connected ─────────────────────────────────────────────────────── */}
      {!loading && isConnected && (
        <>
          <div className="space-y-2">
            {connection!.metaUserName && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                <span>
                  Conta: <span className="font-medium">{connection!.metaUserName}</span>
                </span>
              </div>
            )}
            {selectedCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                <span>
                  {selectedCount} conta{selectedCount !== 1 ? "s" : ""} de anúncio{selectedCount !== 1 ? "s" : ""} ativa{selectedCount !== 1 ? "s" : ""}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock size={14} className="text-gray-400 flex-shrink-0" />
              <span>Última sync: {relativeTime(connection!.lastSyncedAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Zap size={14} className="text-gray-400 flex-shrink-0" />
              <span>Auto-sync: a cada 30 minutos</span>
            </div>
          </div>

          {showAccountSel && (
            <AccountSelector
              connection={connection!}
              onSave={onSelectAccounts}
              saving={savingAccounts}
            />
          )}

          {confirmDisconnect ? (
            <DisconnectConfirm
              onConfirm={() => { setConfirmDisconnect(false); onDisconnect(); }}
              onCancel={() => setConfirmDisconnect(false)}
            />
          ) : (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
              <button
                onClick={onSync}
                disabled={syncing || selectedCount === 0}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-green-500 text-white text-sm font-semibold disabled:opacity-50 hover:bg-green-600 active:scale-[0.99] transition-all"
              >
                <RefreshCw size={13} strokeWidth={2.5} className={cn(syncing && "animate-spin")} />
                {syncing ? "Sincronizando…" : "Sincronizar agora"}
              </button>
              <button
                onClick={() => setConfirmDisconnect(true)}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Unlink size={13} strokeWidth={2} />
                Desconectar
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Error / Expired ────────────────────────────────────────────────── */}
      {!loading && needsReconnect && (
        <>
          <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 rounded-xl border border-amber-100">
            <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 leading-relaxed">
              {connection?.status === "token_expired"
                ? "O token de acesso expirou. Reconecte para retomar a sincronização automática."
                : connection?.lastError ?? "Erro na última sincronização. Reconecte sua conta."}
            </p>
          </div>
          <a
            href="/api/integrations/meta/connect"
            className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            style={{ background: "#1877F2" }}
          >
            Reconectar Meta Ads
            <ChevronRight size={14} strokeWidth={2.5} />
          </a>
        </>
      )}

      {/* ── Not connected ──────────────────────────────────────────────────── */}
      {!loading && !connection && (
        <>
          <div className="space-y-2.5">
            <p className="text-sm text-gray-500 leading-relaxed">
              Elimine o preenchimento manual. Conecte sua conta Meta Ads e sincronize automaticamente:
            </p>
            <ul className="space-y-2">
              {[
                "Investimento e leads por campanha",
                "CPL, CTR e CPM em tempo real",
                "Conversões, ROAS e ROI automáticos",
                "Histórico de até 30 dias",
              ].map(item => (
                <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <a
              href="/api/integrations/meta/connect"
              className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              style={{ background: "#1877F2" }}
            >
              Conectar Meta Ads
              <ChevronRight size={14} strokeWidth={2.5} />
            </a>
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
              <Shield size={11} strokeWidth={2} />
              <span>Acesso somente leitura · Dados protegidos</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Coming soon card ─────────────────────────────────────────────────────────

function ComingSoonCard({
  name,
  logoChar,
  logoColor,
  description,
}: {
  name:        string;
  logoChar:    string;
  logoColor:   string;
  description: string;
}) {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100/80 p-6 flex flex-col gap-5 opacity-55"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)" }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-base font-bold flex-shrink-0"
            style={{ background: logoColor }}
          >
            {logoChar}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{name}</p>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Em breve</span>
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-500 leading-relaxed flex-1">{description}</p>
      <button
        disabled
        className="w-full h-10 rounded-xl bg-gray-100 text-gray-400 text-sm font-semibold cursor-not-allowed"
      >
        Em breve
      </button>
    </div>
  );
}

// ─── Sync log section ─────────────────────────────────────────────────────────

function SetupGuide() {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100/80 p-6"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)" }}
    >
      <p className="text-sm font-semibold text-gray-900 mb-4">Configuração necessária</p>
      <div className="space-y-3">
        {[
          {
            step: "1",
            title: "Crie um app no Meta for Developers",
            desc: "Acesse developers.facebook.com, crie um app do tipo Business e ative o produto Marketing API.",
          },
          {
            step: "2",
            title: "Configure as variáveis de ambiente",
            desc: 'Adicione META_APP_ID, META_APP_SECRET e META_REDIRECT_URI no arquivo .env.local do projeto.',
          },
          {
            step: "3",
            title: "Registre a URL de callback",
            desc: "No painel do Meta App, adicione a URL de callback nas configurações OAuth do Facebook Login.",
          },
        ].map(s => (
          <div key={s.step} className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-green-50 text-green-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
              {s.step}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">{s.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 p-3 bg-gray-50 rounded-xl border border-gray-100">
        <p className="text-xs font-mono text-gray-600 leading-relaxed">
          META_APP_ID=seu_app_id<br />
          META_APP_SECRET=seu_app_secret<br />
          META_REDIRECT_URI=https://seu-dominio.com/api/integrations/meta/callback
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function IntegrationsShell() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [connection,     setConnection]     = useState<MetaConnectionInfo | null>(null);
  const [loadingConn,    setLoadingConn]    = useState(true);
  const [syncing,        setSyncing]        = useState(false);
  const [savingAccounts, setSavingAccounts] = useState(false);
  const [toast,          setToast]          = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const oauthError    = searchParams.get("error");
  const justConnected = searchParams.get("connected") === "true";

  const isMetaConfigured = true; // Show setup guide only if env vars missing (checked server-side)

  function showToast(msg: string, type: "ok" | "err") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  }

  const loadConnection = useCallback(async () => {
    setLoadingConn(true);
    try {
      const info = await getMetaConnectionStatus();
      setConnection(info);
    } finally {
      setLoadingConn(false);
    }
  }, []);

  useEffect(() => {
    void loadConnection();
  }, [loadConnection]);

  useEffect(() => {
    if (justConnected) {
      showToast("Meta Ads conectado com sucesso!", "ok");
      router.replace("/traffic/integrations", { scroll: false });
    }
    if (oauthError) {
      const ERRORS: Record<string, string> = {
        access_denied:     "Acesso negado. Tente novamente.",
        state_mismatch:    "Erro de segurança (CSRF). Tente novamente.",
        connection_failed: "Falha na conexão. Verifique as credenciais do app Meta.",
        invalid_callback:  "Callback inválido. Tente novamente.",
      };
      showToast(ERRORS[oauthError] ?? "Erro desconhecido ao conectar.", "err");
      router.replace("/traffic/integrations", { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justConnected, oauthError]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res  = await fetch("/api/integrations/meta/sync", { method: "POST" });
      const data = await res.json() as { error?: string; recordsSynced?: number };
      if (!res.ok || data.error) throw new Error(data.error ?? "Erro na sincronização");
      showToast(`Sincronização concluída · ${data.recordsSynced} registros`, "ok");
      await loadConnection();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erro na sincronização", "err");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    const res = await fetch("/api/integrations/meta/disconnect", { method: "POST" });
    if (res.ok) {
      setConnection(null);
      showToast("Conta Meta Ads desconectada.", "ok");
    }
  }

  async function handleSelectAccounts(ids: string[]) {
    if (!connection) return;
    setSavingAccounts(true);
    try {
      await selectAdAccounts(connection.id, ids);
      await loadConnection();
      if (ids.length > 0) {
        showToast("Contas salvas. Iniciando sincronização inicial…", "ok");
        await handleSync();
      }
    } finally {
      setSavingAccounts(false);
    }
  }

  return (
    <div className="px-8 py-6 max-w-[1280px] space-y-8">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Section label */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
          Plataformas disponíveis
        </p>
        <p className="text-sm text-gray-500">
          Conecte suas fontes de tráfego para sincronização automática de dados.
        </p>
      </div>

      {/* Integration cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <MetaAdsCard
          connection={connection}
          loading={loadingConn}
          syncing={syncing}
          savingAccounts={savingAccounts}
          onSync={handleSync}
          onDisconnect={handleDisconnect}
          onSelectAccounts={handleSelectAccounts}
        />
        <ComingSoonCard
          name="Google Ads"
          logoChar="G"
          logoColor="#4285F4"
          description="Sincronize campanhas de Search, Display e YouTube automaticamente com o Eliorah System."
        />
        <ComingSoonCard
          name="Google Analytics"
          logoChar="A"
          logoColor="#F57C00"
          description="Importe sessões, conversões e comportamento de usuários do seu site para o dashboard."
        />
      </div>

      {/* Setup guide (shown when not connected) */}
      {!loadingConn && !connection && isMetaConfigured && <SetupGuide />}

      {/* Security note */}
      <div className="flex items-start gap-3 p-4 bg-blue-50/70 rounded-xl border border-blue-100">
        <Shield size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold">Segurança e privacidade</p>
          <p className="text-blue-600/80 mt-0.5 leading-relaxed">
            Tokens de acesso são armazenados com segurança no servidor e jamais expostos no
            frontend. O acesso é somente leitura — nunca criamos, editamos ou excluímos campanhas.
          </p>
        </div>
      </div>
    </div>
  );
}
