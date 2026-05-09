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
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const [initials, setInitials] = useState("SP");

  useEffect(() => {
    const load = () => setInitials(teamInitials(settingsStorage.get().teamName));
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  const visibleNav = ALL_NAV_ITEMS.filter(
    (item) => !user || item.roles.has(user.role),
  );

  const uInitials  = user ? userInitials(user.name) : "–";
  const roleColor  = user ? (ROLE_COLORS[user.role] ?? ROLE_COLORS.vendedor) : ROLE_COLORS.vendedor;

  return (
    <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50">
      <nav
        className="flex flex-col items-center gap-1 rounded-2xl py-3 px-2"
        style={{
          background: isDark ? "rgba(22,26,34,0.92)" : "rgba(255,255,255,0.78)",
          backdropFilter: "blur(20px) saturate(1.6)",
          WebkitBackdropFilter: "blur(20px) saturate(1.6)",
          boxShadow: isDark
            ? "0 2px 8px rgba(0,0,0,0.32), 0 12px 32px rgba(0,0,0,0.20), inset 0 0 0 1px rgba(255,255,255,0.06)"
            : "0 2px 8px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(255,255,255,0.72)",
        }}
      >
        {/* Team logo */}
        <div className="mb-2 w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center">
          <span className="text-white text-xs font-bold tracking-tight">{initials}</span>
        </div>

        <div className="w-5 h-px bg-gray-100 my-1" />

        {/* Nav items (filtered by role) */}
        {visibleNav.map(({ icon: Icon, label, href }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Tooltip key={href}>
              <TooltipTrigger
                render={
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150",
                      isActive
                        ? "bg-green-50 text-green-700"
                        : "text-gray-400 hover:bg-gray-50 hover:text-gray-600",
                    )}
                  />
                }
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                {label}
              </TooltipContent>
            </Tooltip>
          );
        })}

        {/* Separator + theme toggle */}
        <div className="w-5 h-px bg-gray-100 my-1" />

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                onClick={toggle}
                className="flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              />
            }
          >
            {isDark
              ? <Sun  size={18} strokeWidth={1.8} />
              : <Moon size={18} strokeWidth={1.8} />}
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            {isDark ? "Modo claro" : "Modo escuro"}
          </TooltipContent>
        </Tooltip>

        {/* User section */}
        {user && (
          <>
            <div className="w-5 h-px bg-gray-100 my-1" />

            <Tooltip>
              <TooltipTrigger
                render={
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl cursor-default" />
                }
              >
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold",
                  roleColor,
                )}>
                  {uInitials}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                <span className="font-semibold">{user.name}</span>
                <span className="text-gray-400"> · {user.role}</span>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={signOut}
                    className="flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 text-gray-300 hover:bg-red-50 hover:text-red-500"
                  />
                }
              >
                <LogOut size={16} strokeWidth={1.8} />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                Sair
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </nav>
    </div>
  );
}
