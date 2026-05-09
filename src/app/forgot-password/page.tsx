"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, AlertCircle, Loader2, MailCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [email,      setEmail]      = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent,       setSent]       = useState(false);
  const [error,      setError]      = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !email.trim()) return;
    setError("");
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 900));
    setSubmitting(false);
    setSent(true);
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

          <p
            className="text-[11px] font-semibold tracking-[0.16em] uppercase mb-6"
            style={{ color: "rgba(26,50,40,0.45)" }}
          >
            Eliorah System
          </p>

          {sent ? (
            <>
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-green-50 border border-green-100 mb-4">
                <MailCheck size={20} className="text-green-600" strokeWidth={1.8} />
              </div>
              <h1 className="text-[22px] font-bold text-gray-900 tracking-tight mb-1.5">
                Verifique seu e-mail
              </h1>
              <p className="text-[13px] text-gray-500 leading-relaxed max-w-[280px] mx-auto">
                Se houver uma conta vinculada a{" "}
                <span className="text-gray-700 font-medium">{email}</span>,
                enviaremos as instruções de recuperação.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-[22px] font-bold text-gray-900 tracking-tight mb-1.5">
                Recuperar acesso
              </h1>
              <p className="text-[13px] text-gray-500">
                Informe seu e-mail para receber as instruções
              </p>
            </>
          )}
        </div>

        {/* Card */}
        <div
          className="bg-white rounded-2xl border border-gray-100 px-7 py-6"
          style={{
            boxShadow:
              "0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.05), 0 0 0 1px rgba(255,255,255,0.6)",
          }}
        >
          {sent ? (
            <Link
              href="/login"
              className="w-full h-[46px] bg-gray-50 border border-gray-200 text-gray-700 rounded-xl text-[13.5px] font-semibold flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={14} strokeWidth={2.5} />
              Voltar para o login
            </Link>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  autoFocus
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-[11px] text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-green-300 focus:ring-2 focus:ring-green-100 focus:bg-white transition-all duration-150"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center gap-2.5">
                  <AlertCircle size={14} className="text-red-500 flex-shrink-0" strokeWidth={2} />
                  <p className="text-[13px] text-red-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className={cn(
                  "w-full h-[46px] rounded-xl text-[13.5px] font-semibold flex items-center justify-center gap-2 transition-all duration-150",
                  submitting || !email.trim()
                    ? "opacity-50 cursor-not-allowed"
                    : "active:scale-[0.99]",
                )}
                style={{ background: "#1a3228", color: "white" }}
                onMouseEnter={(e) => {
                  if (!submitting && email.trim()) e.currentTarget.style.background = "#213d30";
                }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#1a3228"; }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    Enviar instruções
                    <ArrowRight size={14} strokeWidth={2.5} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {!sent && (
          <p className="text-center text-[12px] text-gray-400 mt-6">
            Lembrou a senha?{" "}
            <Link href="/login" className="text-gray-600 hover:text-gray-900 transition-colors">
              Entrar
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
