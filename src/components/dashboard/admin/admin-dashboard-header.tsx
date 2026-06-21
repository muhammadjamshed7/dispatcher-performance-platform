"use client";

import Link from "next/link";

import { Download, RefreshCw } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdminDashboardHeaderProps = {
  onRefresh: () => void;
  isRefreshing?: boolean;
};

export function AdminDashboardHeader({
  onRefresh,
  isRefreshing = false,
}: AdminDashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A]">
          Admin Dashboard
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[#64748B]">
          Real-time performance overview and key insights across your organization.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/reports"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-10 rounded-[10px] border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC]",
          )}
        >
          <Download className="size-4" />
          Export Report
        </Link>
        <Button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-10 rounded-[10px] bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
        >
          <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
    </div>
  );
}
