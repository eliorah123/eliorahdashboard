"use client";

import { Suspense } from "react";
import Link from "next/link";
import { FloatingSidebar } from "@/components/sidebar";
import { IntegrationsShell } from "@/components/integrations-shell";
import { cn } from "@/lib/utils";

// ─── Shared tab bar (mirrors traffic/page.tsx) ────────────────────────────────

const TABS = [
  { id: "visao-geral",  label: "Visão Geral", href: "/traffic?tab=visao-geral" },
  { id: "insights",     label: "Insights",    href: "/traffic?tab=insights"    },
  { id: "integracoes",  label: "Integrações", href: "/traffic/integrations"    },
] as const;

function TabBar() {
  return (
    <div className="sticky top-0 z-30 mt-5 bg-white/80 dark:bg-[#0F1115]/95 backdrop-blur-md border-b border-white/40">
      <div className="flex items-center gap-1 border-b border-gray-100 px-8 overflow-x-auto">
        {TABS.map(tab => (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              "relative flex-shrink-0 h-11 px-4 text-sm font-semibold transition-colors",
              tab.id === "integracoes"
                ? "text-gray-900"
                : "text-gray-400 hover:text-gray-600",
            )}
          >
            {tab.label}
            {tab.id === "integracoes" && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-green-500 rounded-full" />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function IntegrationsContent() {
  return (
    <div className="min-h-screen">
      <FloatingSidebar />
      <div className="pl-[220px]">
        <div className="px-8 pt-8 pb-0">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tráfego Pago</h1>
          <p className="text-sm text-gray-400 mt-0.5">Centro de inteligência de performance</p>
        </div>
        <TabBar />
        <IntegrationsShell />
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={null}>
      <IntegrationsContent />
    </Suspense>
  );
}
