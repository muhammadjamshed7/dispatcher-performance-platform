"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

type DispatcherDashboardHeaderProps = {
  onRefresh: () => void;
  isRefreshing?: boolean;
};

export function DispatcherDashboardHeader({
  onRefresh,
  isRefreshing = false,
}: DispatcherDashboardHeaderProps) {
  return (
    <div className="flex justify-end">
      <Button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="h-10 shrink-0 rounded-[10px] bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
      >
        <RefreshCw
          className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
        />
        Refresh
      </Button>
    </div>
  );
}
