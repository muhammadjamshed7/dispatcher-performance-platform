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
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: iconBackground, color: accent }}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
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
          <Sparkline
            data={sparklineData}
            color={accent}
            className="h-9 w-[88px] shrink-0"
          />
        ) : null}
      </div>
    </div>
  );
}
