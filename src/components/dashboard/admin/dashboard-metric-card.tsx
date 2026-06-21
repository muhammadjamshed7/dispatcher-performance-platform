import type { LucideIcon } from "lucide-react";

import { Sparkline } from "@/components/dashboard/admin/sparkline";
import { cn } from "@/lib/utils";

type DashboardMetricCardProps = {
  label: string;
  value: string;
  helper: string;
  growth?: string | null;
  accent: string;
  iconBackground: string;
  icon: LucideIcon;
  sparklineData?: number[];
  sparklineFormatter?: (value: number) => string;
  className?: string;
};

export function DashboardMetricCard({
  label,
  value,
  helper,
  growth,
  accent,
  iconBackground,
  icon: Icon,
  sparklineData = [],
  sparklineFormatter,
  className,
}: DashboardMetricCardProps) {
  const showSparkline = sparklineData.length > 0;

  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: iconBackground, color: accent }}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#64748B]">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-[#0F172A]">
            {value}
          </p>
          <p className="mt-1 text-xs text-[#64748B]">{helper}</p>
          {growth ? (
            <p className="mt-2 text-xs font-medium text-[#22C55E]">{growth}</p>
          ) : null}
        </div>
      </div>

      {showSparkline ? (
        <div className="mt-4 border-t border-[#F1F5F9] pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#94A3B8]">
              Last 7 days
            </p>
          </div>
          <Sparkline
            data={sparklineData}
            color={accent}
            valueFormatter={sparklineFormatter}
            className="h-14 w-full"
          />
        </div>
      ) : null}
    </div>
  );
}
