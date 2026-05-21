"use client";

import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Info,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrafficInsight, InsightSentiment } from "@/types/traffic";

// ─── Config per sentiment ─────────────────────────────────────────────────────

const SENTIMENT_CONFIG: Record<
  InsightSentiment,
  { icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>; iconClass: string; bgClass: string; borderClass: string }
> = {
  positive: {
    icon:        TrendingUp,
    iconClass:   "text-green-600",
    bgClass:     "bg-green-50",
    borderClass: "border-green-100",
  },
  negative: {
    icon:        TrendingDown,
    iconClass:   "text-red-500",
    bgClass:     "bg-red-50",
    borderClass: "border-red-100",
  },
  warning: {
    icon:        AlertTriangle,
    iconClass:   "text-amber-600",
    bgClass:     "bg-amber-50",
    borderClass: "border-amber-100",
  },
  neutral: {
    icon:        Info,
    iconClass:   "text-blue-500",
    bgClass:     "bg-blue-50",
    borderClass: "border-blue-100",
  },
};

// ─── Single insight card ──────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: TrafficInsight }) {
  const cfg  = SENTIMENT_CONFIG[insight.type];
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-4 bg-white rounded-2xl p-5 border transition-shadow hover:shadow-sm",
        cfg.borderClass,
      )}
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)" }}
    >
      <div
        className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
          cfg.bgClass,
        )}
      >
        <Icon size={16} strokeWidth={2} className={cfg.iconClass} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 leading-snug">{insight.title}</p>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">{insight.description}</p>
      </div>
      {insight.change !== undefined && (
        <span
          className={cn(
            "flex-shrink-0 text-xs font-bold px-2 py-1 rounded-full",
            insight.change > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-500",
          )}
        >
          {insight.change > 0 ? "+" : ""}{insight.change.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function InsightsHeader() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
        <Sparkles size={15} strokeWidth={2} className="text-white" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900">Insights Automáticos</p>
        <p className="text-xs text-gray-400">Análise do período selecionado vs. período anterior</p>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TrafficInsightsProps {
  insights: TrafficInsight[];
}

export function TrafficInsights({ insights }: TrafficInsightsProps) {
  const positives = insights.filter(i => i.type === "positive");
  const warnings  = insights.filter(i => i.type === "warning" || i.type === "negative");
  const neutrals  = insights.filter(i => i.type === "neutral");

  return (
    <div className="px-8 py-6 max-w-[1280px] space-y-6">
      <InsightsHeader />

      {/* Summary counts */}
      <div className="flex flex-wrap gap-4">
        {[
          { label: "Positivos",  count: positives.length, color: "bg-green-50 text-green-700" },
          { label: "Atenção",    count: warnings.length,  color: "bg-amber-50 text-amber-700" },
          { label: "Neutros",    count: neutrals.length,  color: "bg-blue-50 text-blue-700"   },
        ].map(s => (
          <div
            key={s.label}
            className={cn("inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold", s.color)}
          >
            <span>{s.count}</span>
            <span className="opacity-70">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Insight cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {insights.map(insight => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>

      {insights.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Sparkles size={28} className="text-gray-200" strokeWidth={1.5} />
          <p className="text-sm text-gray-400">Sem insights disponíveis para o período selecionado.</p>
        </div>
      )}
    </div>
  );
}
