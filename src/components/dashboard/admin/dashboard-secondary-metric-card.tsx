import type { LucideIcon } from "lucide-react";
import { MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type DashboardSecondaryMetricCardProps = {
  label: string;
  value: string;
  helper: string;
  growth?: string | null;
  accent: string;
  iconBackground: string;
  icon: LucideIcon;
  className?: string;
};

export function DashboardSecondaryMetricCard({
  label,
  value,
  helper,
  growth,
  accent,
  iconBackground,
  icon: Icon,
  className,
}: DashboardSecondaryMetricCardProps) {
  return (
    <article
      className={cn(
        "min-w-0 rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]",
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

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-8 shrink-0 rounded-lg text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#475569]"
                aria-label={`${label} actions`}
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
    </article>
  );
}
