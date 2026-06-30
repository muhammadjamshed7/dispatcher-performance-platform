import Link from "next/link";

import { ChevronDown } from "lucide-react";

import { DASHBOARD_CHART_CARD_CLASS } from "@/components/dashboard/admin/dashboard-chart-styles";
import { cn } from "@/lib/utils";
import { formatCurrencyCompact } from "@/lib/utils/format-currency";

type TopPerformer = {
  rank: number;
  name: string;
  initials: string;
  team: string;
  revenue: number;
};

type TopPerformersCardProps = {
  performers: TopPerformer[];
  className?: string;
};

const MEDALS = ["🥇", "🥈", "🥉"];

export function TopPerformersCard({
  performers,
  className,
}: TopPerformersCardProps) {
  const hasPerformers = performers.length > 0;

  return (
    <div className={cn(DASHBOARD_CHART_CARD_CLASS, className)}>
      <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <h3 className="truncate text-base font-semibold text-[#0F172A]">
          Top Performers
        </h3>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#475569]"
        >
          This Week
          <ChevronDown className="size-3.5" />
        </button>
      </div>

      <div className="flex min-h-[280px] flex-1 flex-col">
        {hasPerformers ? (
          <div className="space-y-4">
            {performers.map((performer) => (
              <div
                key={performer.name}
                className="flex min-w-0 items-center gap-3"
              >
                <span className="w-6 shrink-0 text-center text-lg">
                  {MEDALS[performer.rank - 1] ?? performer.rank}
                </span>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-sm font-semibold text-[#1D4ED8]">
                  {performer.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#0F172A]">
                    {performer.name}
                  </p>
                  <p className="truncate text-xs text-[#64748B]">
                    {performer.team}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-[#0F172A]">
                    {formatCurrencyCompact(performer.revenue)}
                  </p>
                  <p className="text-[11px] text-[#64748B]">Revenue</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-[#64748B]">No data available</p>
          </div>
        )}
      </div>

      <Link
        href="/admin/rankings"
        className="mt-5 inline-flex shrink-0 text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8]"
      >
        View all rankings →
      </Link>
    </div>
  );
}
