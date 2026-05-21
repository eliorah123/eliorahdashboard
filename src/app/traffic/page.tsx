"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FloatingSidebar } from "@/components/sidebar";
import { TrafficOverview } from "@/components/traffic-overview";
import { TrafficInsights } from "@/components/traffic-insights";
import { useTrafficData } from "@/hooks/use-traffic-data";
import type { TrafficPeriod } from "@/types/traffic";
import { cn } from "@/lib/utils";

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "visao-geral", label: "Visão Geral" },
  { id: "insights",    label: "Insights"    },
] as const;

type TabId = typeof TABS[number]["id"];

function isValidTab(t: string | null): t is TabId {
  return TABS.some(tab => tab.id === t);
}

// ─── Period filter ────────────────────────────────────────────────────────────

const PERIODS: { value: TrafficPeriod; label: string }[] = [
  { value: "7d",  label: "7 dias"  },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
];

function PeriodFilter({
  value,
  onChange,
}: {
  value: TrafficPeriod;
  onChange: (p: TrafficPeriod) => void;
}) {
  return (
    <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
      {PERIODS.map(p => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={cn(
            "h-7 px-3 rounded-lg text-xs font-semibold transition-all",
            value === p.value
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ─── Tab nav ──────────────────────────────────────────────────────────────────

function TabNav({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <div className="flex items-center gap-1 border-b border-gray-100 px-8 overflow-x-auto">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative flex-shrink-0 h-11 px-4 text-sm font-semibold transition-colors",
            active === tab.id
              ? "text-gray-900"
              : "text-gray-400 hover:text-gray-600"
          )}
        >
          {tab.label}
          {active === tab.id && (
            <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-green-500 rounded-full" />
          )}
        </button>
      ))}
      {/* Integrações routes to a separate page */}
      <Link
        href="/traffic/integrations"
        className="relative flex-shrink-0 h-11 px-4 text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors"
      >
        Integrações
      </Link>
    </div>
  );
}

// ─── Inner content ────────────────────────────────────────────────────────────

function TrafficContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const raw          = searchParams.get("tab");
  const activeTab: TabId = isValidTab(raw) ? raw : "visao-geral";

  const [period, setPeriod] = useState<TrafficPeriod>("30d");
  const data = useTrafficData(period);

  function navigate(id: TabId) {
    router.replace(`/traffic?tab=${id}`, { scroll: false });
  }

  return (
    <div className="min-h-screen">
      <FloatingSidebar />
      <div className="pl-[220px]">
        {/* Header */}
        <div className="px-8 pt-8 pb-0 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tráfego Pago</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Centro de inteligência de performance
            </p>
          </div>
          <PeriodFilter value={period} onChange={p => { setPeriod(p); }} />
        </div>

        {/* Sticky tabs */}
        <div className="sticky top-0 z-30 mt-5 bg-white/80 dark:bg-[#0F1115]/95 backdrop-blur-md border-b border-white/40">
          <TabNav active={activeTab} onChange={navigate} />
        </div>

        {/* Tab content */}
        {activeTab === "visao-geral" && (
          <TrafficOverview kpis={data.kpis} chartData={data.chartData} />
        )}
        {activeTab === "insights" && (
          <TrafficInsights insights={data.insights} />
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrafficPage() {
  return (
    <Suspense fallback={null}>
      <TrafficContent />
    </Suspense>
  );
}
