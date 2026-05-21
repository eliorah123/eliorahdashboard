"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Settings,
  Moon,
  Sun,
  LogOut,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { settingsStorage } from "@/lib/storage";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/contexts/auth-context";
import type { UserRole } from "@/lib/auth";

// ─── Nav items with role visibility ───────────────────────────────────────────

const ALL_NAV_ITEMS = [
  {
    icon:  LayoutDashboard,
    label: "Dashboard",
    href:  "/",
    roles: new Set<UserRole>(["admin", "gestor"]),
  },
  {
    icon:  TrendingUp,
    label: "Vendas",
    href:  "/sales",
    roles: new Set<UserRole>(["admin", "gestor", "vendedor"]),
  },
  {
    icon:  Target,
    label: "Tráfego Pago",
    href:  "/traffic",
    roles: new Set<UserRole>(["admin", "gestor"]),
  },
  {
    icon:  Users,
    label: "Vendedores",
    href:  "/sellers",
    roles: new Set<UserRole>(["admin", "gestor"]),
  },
  {
    icon:  Settings,
    label: "Configurações",
    href:  "/settings",
    roles: new Set<UserRole>(["admin"]),
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function teamInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

function userInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

const ROLE_LABELS: Record<string, string> = {
  admin:    "Administrador",
  gestor:   "Gestor",
  vendedor: "Vendedor",
};

const ROLE_COLORS: Record<string, string> = {
  admin:    "bg-purple-100 text-purple-700",
  gestor:   "bg-blue-100 text-blue-700",
  vendedor: "bg-green-100 text-green-700",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function FloatingSidebar() {
  const pathname           = usePathname();
  const { isDark, toggle } = useTheme();
  const { user, signOut }  = useAuth();
  const [teamName, setTeamName] = useState("Sales Pro");

  useEffect(() => {
    const load = () => setTeamName(settingsStorage.get().teamName || "Sales Pro");
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  const visibleNav = ALL_NAV_ITEMS.filter(
    (item) => !user || item.roles.has(user.role),
  );

  const uInitials = user ? userInitials(user.name) : "–";
  const roleColor = user ? (ROLE_COLORS[user.role] ?? ROLE_COLORS.vendedor) : ROLE_COLORS.vendedor;
  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role) : "";

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-[220px] z-50 flex flex-col"
      style={{
        background: isDark ? "#161A22" : "#ffffff",
        borderRight: isDark
          ? "1px solid rgba(255,255,255,0.06)"
          : "1px solid rgba(0,0,0,0.06)",
        boxShadow: isDark
          ? "2px 0 16px rgba(0,0,0,0.18)"
          : "2px 0 20px rgba(0,0,0,0.05)",
      }}
    >
      {/* ── Logo / Team header ─────────────────────────────────────────────── */}
      <div className="px-5 py-5 flex items-center gap-3 flex-shrink-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #0d3a26 0%, #1a9e62 100%)",
            boxShadow: "0 2px 8px rgba(26,158,98,0.30)",
          }}
        >
          <span className="text-white text-xs font-bold tracking-tight">
            {teamInitials(teamName)}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate leading-tight">
            {teamName}
          </p>
          <p className="text-[10px] text-gray-400 leading-tight mt-0.5">Plataforma de Vendas</p>
        </div>
      </div>

      {/* ── Divider ────────────────────────────────────────────────────────── */}
      <div className="mx-4 h-px bg-gray-100 flex-shrink-0" />

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
        {visibleNav.map(({ icon: Icon, label, href }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-medium transition-all duration-150",
                isActive
                  ? "text-white"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700",
              )}
              style={isActive ? {
                background: "linear-gradient(135deg, #0d3a26 0%, #1a9e62 100%)",
                boxShadow: "0 2px 10px rgba(26,158,98,0.28)",
              } : {}}
            >
              <Icon size={17} strokeWidth={isActive ? 2.5 : 1.8} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom section ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-3 pb-4">
        <div className="h-px bg-gray-100 mx-1 mb-2" />

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all duration-150"
        >
          {isDark
            ? <Sun  size={17} strokeWidth={1.8} />
            : <Moon size={17} strokeWidth={1.8} />}
          <span>{isDark ? "Modo claro" : "Modo escuro"}</span>
        </button>

        {/* User section */}
        {user && (
          <div className="mt-0.5 flex items-center gap-2.5 px-3 py-2.5 rounded-xl">
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0",
                roleColor,
              )}
            >
              {uInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate leading-tight">
                {user.name}
              </p>
              <p className="text-[10px] text-gray-400 leading-tight">{roleLabel}</p>
            </div>
            <button
              onClick={signOut}
              className="flex items-center justify-center w-6 h-6 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-all duration-150 flex-shrink-0"
              title="Sair"
            >
              <LogOut size={13} strokeWidth={1.8} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
