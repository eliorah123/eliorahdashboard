"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const { signIn } = useAuth();

  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [remember,   setRemember]   = useState(false);
  const [showPass,   setShowPass]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    const result = await signIn(email, password);
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-5"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(134,197,150,0.10) 0%, transparent 65%), #f3f6f3",
      }}
    >
      <div className="w-full max-w-[380px]">

        {/* Brand */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-11 h-11 rounded-2xl mb-4"
            style={{
              background: "linear-gradient(135deg, #1a3228 0%, #2d5a3d 100%)",
              boxShadow: "0 2px 8px rgba(26,50,40,0.20), 0 1px 2px rgba(26,50,40,0.12)",
            }}
          >
            <span className="text-white font-bold text-[15px] tracking-tight">E</span>
          </div>

          <p className="text-[11px] font-semibold tracking-[0.16em] uppercase mb-6"
             style={{ color: "rgba(26,50,40,0.45)" }}>
            Eliorah System
          </p>

          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight mb-1.5">
            Bem-vindo de volta
          </h1>
          <p className="text-[13px] text-gray-500">
            Acesso restrito à equipe interna
          </p>
        </div>

        {/* Card */}
        <div
          className="bg-white rounded-2xl border border-gray-100 px-7 py-6"
          style={{
            boxShadow:
              "0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.05), 0 0 0 1px rgba(255,255,255,0.6)",
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 mb-1.5 tracking-wide">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@eliorah.com"
                required
                autoComplete="email"
                autoFocus
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-[11px] text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-green-300 focus:ring-2 focus:ring-green-100 focus:bg-white transition-all duration-150"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[12px] font-semibold text-gray-500 tracking-wide">
                  Senha
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Esqueceu?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-[11px] pr-11 text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-green-300 focus:ring-2 focus:ring-green-100 focus:bg-white transition-all duration-150"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPass
                    ? <EyeOff size={15} strokeWidth={1.8} />
                    : <Eye    size={15} strokeWidth={1.8} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                role="checkbox"
                aria-checked={remember}
                onClick={() => setRemember((v) => !v)}
                className={cn(
                  "w-[17px] h-[17px] rounded-[4px] border flex items-center justify-center flex-shrink-0 transition-all duration-150",
                  remember
                    ? "border-[#1a3228]"
                    : "bg-white border-gray-300 hover:border-gray-400",
                )}
                style={remember ? { background: "#1a3228", borderColor: "#1a3228" } : {}}
              >
                {remember && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path
                      d="M1 4L3.5 6.5L9 1"
                      stroke="white"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
              <span
                className="text-[13px] text-gray-500 select-none cursor-pointer"
                onClick={() => setRemember((v) => !v)}
              >
                Manter conectado por 30 dias
              </span>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center gap-2.5">
                <AlertCircle size={14} className="text-red-500 flex-shrink-0" strokeWidth={2} />
                <p className="text-[13px] text-red-600">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className={cn(
                "w-full h-[46px] rounded-xl text-[13.5px] font-semibold flex items-center justify-center gap-2 transition-all duration-150 mt-1",
                submitting
                  ? "cursor-not-allowed opacity-60"
                  : "active:scale-[0.99]",
              )}
              style={{
                background: submitting ? "#1a3228" : "#1a3228",
                color: "white",
              }}
              onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.background = "#213d30"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#1a3228"; }}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight size={14} strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer note */}
        <p className="text-center text-[12px] text-gray-400 mt-6 leading-relaxed">
          Plataforma de uso interno.{" "}
          <br className="sm:hidden" />
          Acesso permitido apenas a membros autorizados.
        </p>
      </div>
    </main>
  );
}
