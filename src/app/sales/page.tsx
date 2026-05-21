"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FloatingSidebar } from "@/components/sidebar";
import { CalendarInput } from "@/components/calendar-input";
import { SalesRecords } from "@/components/sales-records";
import { SalesOverview } from "@/components/sales-overview";
import { SalesSellers } from "@/components/sales-sellers";
import { GoalsForm } from "@/components/goals-form";
import { SalesInsights } from "@/components/sales-insights";

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "calendario",  label: "Calendário"  },
  { id: "registros",   label: "Registros"   },
  { id: "visao-geral", label: "Visão Geral" },
  { id: "vendedores",  label: "Vendedores"  },
  { id: "metas",       label: "Metas"       },
  { id: "insights",    label: "Insights"    },
] as const;

type TabId = typeof TABS[number]["id"];

function isValidTab(t: string | null): t is TabId {
  return TABS.some(tab => tab.id === t);
}

// ─── Tab nav ──────────────────────────────────────────────────────────────────

function TabNav({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <div className="flex items-center gap-1 border-b border-gray-100 px-8 overflow-x-auto">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={[
            "relative flex-shrink-0 h-11 px-4 text-sm font-semibold transition-colors",
            active === tab.id
              ? "text-gray-900"
              : "text-gray-400 hover:text-gray-600",
          ].join(" ")}
        >
          {tab.label}
          {active === tab.id && (
            <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-green-500 rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Tab content ──────────────────────────────────────────────────────────────

function TabContent({ tab }: { tab: TabId }) {
  switch (tab) {
    case "calendario":  return <CalendarInput embedded />;
    case "registros":   return <SalesRecords />;
    case "visao-geral": return <SalesOverview />;
    case "vendedores":  return <SalesSellers />;
    case "metas":       return (
      <div className="px-8 py-8 max-w-[760px]">
        <GoalsForm embedded />
      </div>
    );
    case "insights":    return <SalesInsights />;
  }
}

// ─── Inner page (needs Suspense for useSearchParams) ─────────────────────────

function SalesContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const raw          = searchParams.get("tab");
  const activeTab: TabId = isValidTab(raw) ? raw : "calendario";

  function navigate(id: TabId) {
    router.replace(`/sales?tab=${id}`, { scroll: false });
  }

  return (
    <div className="min-h-screen">
      <FloatingSidebar />
      <div className="pl-[220px]">
        {/* Page header */}
        <div className="px-8 pt-8 pb-0">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Vendas</h1>
          <p className="text-sm text-gray-400 mt-0.5 mb-5">
            Centro operacional da plataforma
          </p>
        </div>

        {/* Sticky tab bar */}
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-[#0F1115]/95 backdrop-blur-md border-b border-white/40">
          <TabNav active={activeTab} onChange={navigate} />
        </div>

        {/* Tab content */}
        <TabContent tab={activeTab} />
      </div>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function SalesPage() {
  return (
    <Suspense fallback={null}>
      <SalesContent />
    </Suspense>
  );
}
