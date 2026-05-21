import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: string;
  trend: number;
  prefix?: string;
  suffix?: string;
  description?: string;
  invertSentiment?: boolean;
}

export function KPICard({
  label,
  value,
  trend,
  prefix,
  suffix,
  description,
  invertSentiment = false,
}: KPICardProps) {
  const isPositive = invertSentiment ? trend < 0 : trend > 0;
  const isNegative = invertSentiment ? trend > 0 : trend < 0;
  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <div
      className="bg-white rounded-2xl p-5 border border-gray-100/80 flex flex-col gap-3"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)" }}
    >
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
        {label}
      </p>

      <div className="flex items-end gap-1">
        {prefix && (
          <span className="text-base font-semibold text-gray-400 mb-0.5">
            {prefix}
          </span>
        )}
        <span className="text-[1.75rem] font-bold text-gray-900 leading-none tracking-tight">
          {value}
        </span>
        {suffix && (
          <span className="text-base font-semibold text-gray-400 mb-0.5">
            {suffix}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div
          className={cn(
            "inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1",
            isPositive && "bg-green-50 text-green-700",
            isNegative && "bg-red-50 text-red-500",
            !isPositive && !isNegative && "bg-gray-100 text-gray-500"
          )}
        >
          <TrendIcon size={11} strokeWidth={2.5} />
          <span>
            {isPositive ? "+" : ""}
            {trend.toFixed(1)}%
          </span>
        </div>
        {description && (
          <span className="text-xs text-gray-400">{description}</span>
        )}
      </div>
    </div>
  );
}
