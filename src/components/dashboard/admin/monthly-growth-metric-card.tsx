import { TrendingUp, MoreVertical } from "lucide-react";

import { KpiMonthlyGrowthChart } from "@/components/dashboard/admin/kpi-monthly-growth-chart";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AdminDashboardMonthlyGrowthPoint } from "@/lib/types";

type MonthlyGrowthMetricCardProps = {
  monthlyGrowth: number;
  monthlyGrowthTrend: AdminDashboardMonthlyGrowthPoint[];
  growthLabel?: string | null;
};

export function MonthlyGrowthMetricCard({
  monthlyGrowth,
  monthlyGrowthTrend,
  growthLabel,
}: MonthlyGrowthMetricCardProps) {
  return (
    <article className="min-w-0 rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#CCFBF1] text-[#14B8A6]">
            <TrendingUp className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#64748B]">Monthly Growth</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-[#0F172A]">
              {monthlyGrowth}%
            </p>
            <p className="mt-1 text-xs text-[#64748B]">Revenue growth</p>
            {growthLabel ? (
              <p className="mt-2 text-xs font-medium text-[#22C55E]">
                {growthLabel}
              </p>
            ) : null}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-8 shrink-0 rounded-lg text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#475569]"
                aria-label="Monthly Growth actions"
              />
            }
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[160px]">
            <DropdownMenuItem>View details</DropdownMenuItem>
            <DropdownMenuItem>Export data</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 border-t border-[#F1F5F9] pt-3">
        <KpiMonthlyGrowthChart data={monthlyGrowthTrend} />
      </div>
    </article>
  );
}
