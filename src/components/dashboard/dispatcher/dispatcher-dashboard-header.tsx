"use client";

import { RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type DispatcherDashboardHeaderProps = {
  dispatcherName: string;
  onRefresh: () => void;
  isRefreshing?: boolean;
};

export function DispatcherDashboardHeader({
  dispatcherName,
  onRefresh,
  isRefreshing = false,
}: DispatcherDashboardHeaderProps) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A]">
              Dispatcher Dashboard
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[#64748B]">
              Complete today&apos;s carrier entries and track your personal dispatch
              performance.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="rounded-full border-[#E2E8F0] bg-[#F8FAFC] text-[10px] uppercase tracking-wide text-[#64748B]"
            >
              Session
            </Badge>
            <Badge className="rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-medium text-[#1D4ED8] hover:bg-[#DBEAFE]">
              Dispatcher
            </Badge>
            <Badge
              variant="outline"
              className="rounded-full border-[#E2E8F0] bg-white text-xs font-medium text-[#475569]"
            >
              Personal view for {dispatcherName}
            </Badge>
          </div>
        </div>
        <Button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-10 shrink-0 rounded-[10px] bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
        >
          <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
    </div>
  );
}
