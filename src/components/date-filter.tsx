"use client";

import { cn } from "@/lib/utils";
import type { Period } from "@/hooks/use-dashboard-data";

const OPTIONS: { value: Period; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d",    label: "7D"   },
  { value: "30d",   label: "30D"  },
  { value: "90d",   label: "90D"  },
];

interface DateFilterProps {
  value: Period;
  onChange: (value: Period) => void;
}

export function DateFilter({ value, onChange }: DateFilterProps) {
  return (
    <div className="flex items-center gap-0.5 bg-gray-100/80 rounded-xl p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 cursor-pointer",
            value === opt.value
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
